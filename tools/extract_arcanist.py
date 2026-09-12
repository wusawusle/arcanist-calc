"""Extract the Arcanist sheet from the Obelisk Total Resources Calculator workbook.

Emits src/calc/__fixtures__/arcanist-sheet.json: every populated cell on the
Arcanist sheet, with its cached value and (for computed cells) its formula. This
is the golden fixture the calc engine is tested against, and it is why the
workbook itself does not need to be committed.

Stdlib only -- openpyxl is not required (and is not installed).

Usage:  python tools/extract_arcanist.py [path/to/workbook.xlsx]
"""

from __future__ import annotations

import glob
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
SHEET_NAME = "Arcanist"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(ROOT, "src", "calc", "__fixtures__", "arcanist-sheet.json")


def find_workbook(argv: list[str]) -> str:
    if len(argv) > 1:
        return argv[1]
    candidates = sorted(glob.glob(os.path.join(ROOT, "*.xlsx")))
    if not candidates:
        sys.exit(
            "No .xlsx found in the project root. Pass the workbook path as an argument:\n"
            "  python tools/extract_arcanist.py \"path/to/workbook.xlsx\""
        )
    return candidates[0]


def read_shared_strings(z: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return ["".join(t.text or "" for t in si.iter(NS + "t")) for si in root]


def locate_sheet(z: zipfile.ZipFile, name: str) -> str:
    """Resolve a sheet name to its part path via workbook.xml + its rels."""
    workbook = z.read("xl/workbook.xml").decode("utf-8")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    rel_targets = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))

    for m in re.finditer(r'<sheet name="([^"]*)"[^>]*r:id="([^"]+)"', workbook):
        if m.group(1) == name:
            target = rel_targets[m.group(2)]
            return "xl/" + target.lstrip("/")
    sys.exit(f'Sheet "{name}" not found in workbook.')


def coerce(value: str | None, cell_type: str | None, shared: list[str]):
    """Turn a raw <v> payload into JSON-friendly Python."""
    if value is None:
        return None
    if cell_type == "s":
        return shared[int(value)]
    if cell_type in ("str", "inlineStr", "e"):
        return value
    if cell_type == "b":
        return value == "1"
    try:
        return float(value)
    except ValueError:
        return value


def main() -> None:
    path = find_workbook(sys.argv)
    with zipfile.ZipFile(path) as z:
        shared = read_shared_strings(z)
        sheet_part = locate_sheet(z, SHEET_NAME)
        sheet = ET.fromstring(z.read(sheet_part))

    cells: dict[str, dict] = {}
    # Shared formulas store their text once, on the master cell, keyed by @si.
    shared_formula_masters: dict[str, str] = {}

    for row in sheet.iter(NS + "row"):
        for c in row:
            ref = c.get("r")
            if ref is None:
                continue
            f = c.find(NS + "f")
            v = c.find(NS + "v")
            value = coerce(v.text if v is not None else None, c.get("t"), shared)

            formula = None
            if f is not None:
                si = f.get("si")
                if f.text:
                    formula = " ".join(f.text.split())
                    if si is not None:
                        shared_formula_masters.setdefault(si, formula)
                elif si is not None:
                    # Follower of a shared formula: cell references would need
                    # translating, so record the master's text as a hint only.
                    formula = f"[shared:{si}] {shared_formula_masters.get(si, '')}".strip()

            if value is None and formula is None:
                continue

            entry: dict = {"v": value}
            if formula is not None:
                entry["f"] = formula
            cells[ref] = entry

    payload = {
        "_source": os.path.basename(path),
        "_sheet": SHEET_NAME,
        "_note": (
            "Cached values as last computed by the spreadsheet. Used as the golden "
            "fixture for calc/engine.ts. Regenerate with: npm run fixture"
        ),
        "cells": cells,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=1, sort_keys=False)
        fh.write("\n")

    computed = sum(1 for c in cells.values() if "f" in c)
    print(f"{os.path.relpath(OUT_PATH, ROOT)}: {len(cells)} cells ({computed} computed)")


if __name__ == "__main__":
    main()

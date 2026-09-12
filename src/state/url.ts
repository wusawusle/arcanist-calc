/**
 * Share links.
 *
 * A build is packed to a fixed-order number array (see schema.ts), JSON
 * encoded, then base64url'd into the location hash. That lands at roughly 285
 * characters — short enough to paste anywhere, and the packing is what buys
 * that; the raw keyed object would be about 1 kB.
 *
 * A previous version deflated the payload with CompressionStream to halve it
 * again. That was removed: it made decoding async, it needed a no-compression
 * fallback, and Node and Chromium disagree on the trailing bytes of a raw
 * deflate stream, so tokens did not survive crossing runtimes. 144 saved
 * characters did not justify a failure mode that silently showed the reader
 * the wrong build. The leading format byte is kept so a future encoding can be
 * added without breaking links already in the wild.
 */

import type { ArcanistInput } from '../calc/types';
import { packFields, unpackFields } from './schema';

/**
 * Format marker: plain base64url of the packed JSON array.
 *
 * The packed array is positional, so a field-order change silently reinterprets
 * every value after it. Bumping this letter makes old tokens fail the prefix
 * check and surface "couldn't be read" instead.
 *
 *   p — v1 field order (flat external bonuses)
 *   q — v2 field order (cards / pets / unlocks groups)
 *   r — v3 field order (Exchange down to two upgrades)
 *   s — v4 field order (adds the mined essence)
 *   t — v5 field order (restores all thirteen released Exchange upgrades)
 */
const PACK_FORMAT = 't';
export const HASH_KEY = 'b';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encode a build as an opaque, URL-safe token. */
export function encodeBuild(input: ArcanistInput): string {
  const json = JSON.stringify(packFields(input));
  return PACK_FORMAT + bytesToBase64Url(new TextEncoder().encode(json));
}

/** Decode a token produced by encodeBuild. Returns null if it is not one. */
export function decodeBuild(token: string): ArcanistInput | null {
  if (!token || token[0] !== PACK_FORMAT) return null;

  try {
    const bytes = base64UrlToBytes(token.slice(1));
    const values = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(values)) return null;
    return unpackFields(values);
  } catch {
    return null;
  }
}

export type HashRead =
  | { status: 'none' }
  | { status: 'ok'; input: ArcanistInput }
  | { status: 'invalid' };

/**
 * Read a build out of the location hash.
 *
 * "No link" and "broken link" are reported separately on purpose: silently
 * falling back to the local build when a shared link fails to decode means the
 * reader studies someone else's numbers thinking they are the sender's.
 */
export function readBuildFromHash(hash: string): HashRead {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get(HASH_KEY);
  if (!token) return { status: 'none' };

  const input = decodeBuild(token);
  return input ? { status: 'ok', input } : { status: 'invalid' };
}

export function buildShareUrl(input: ArcanistInput, base = window.location.href): string {
  const url = new URL(base);
  url.hash = `${HASH_KEY}=${encodeBuild(input)}`;
  return url.toString();
}

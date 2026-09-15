/**
 * Screenshot a URL with real (not virtual) wait time, over the Chrome DevTools
 * Protocol. Edge's `--screenshot --virtual-time-budget` fires before real async
 * work such as DecompressionStream settles, which makes it useless for checking
 * anything that awaits a stream.
 *
 * Usage: node tools/shoot.mjs <url> <out.png> [waitMs] [width] [height]
 *
 * ## Shutting the browser down
 *
 * This script spawns a real browser, so every exit path has to close one. An
 * earlier version leaked them badly enough to strand 20 GB of RAM across 43
 * instances, for two reasons worth stating so they are not reintroduced:
 *
 *   1. Cleanup lived in a `finally` around the screenshot only. A timeout
 *      waiting for the debugging endpoint, or a socket that never opened,
 *      rejected *before* that block and orphaned the browser.
 *   2. `child.kill()` terminates the one PID Node spawned. Chromium's children
 *      are not in that call's blast radius on Windows, so the browser lived on
 *      with its parent gone — which is why more instances leaked than temp
 *      profiles did.
 *
 * So: shutdown is registered before the browser is spawned and covers every
 * path including signals, it asks the browser to close over CDP first (which
 * takes the whole tree with it), and it force-kills anything still holding the
 * profile afterwards.
 */

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, waitMs = '2500', width = '1500', height = '900'] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage: node tools/shoot.mjs <url> <out.png> [waitMs] [width] [height]');
  process.exit(1);
}

const EDGE =
  process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const port = 9222 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'shoot-'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let browser;
let ws;
let send = () => Promise.resolve();
let shuttingDown = false;

/**
 * Kill anything still running out of our temp profile.
 *
 * Scoped to this run's `--user-data-dir`, so it can only ever match the browser
 * this script started — never one the user has open.
 */
function killStragglers() {
  if (browser?.pid !== undefined) {
    try {
      if (process.platform === 'win32') {
        // /T for the tree, which is the part child.kill() misses.
        execFileSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        process.kill(-browser.pid, 'SIGKILL');
      }
    } catch {
      /* already gone, which is the goal */
    }
  }

  if (process.platform !== 'win32') return;
  try {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |` +
          ` Where-Object { $_.CommandLine -like '*${profile.replace(/\\/g, '\\\\')}*' } |` +
          ` ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: 'ignore' },
    );
  } catch {
    /* best effort */
  }
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  // Asking over CDP is the reliable close: it targets the browser we are
  // actually attached to, whatever happened to the PID we spawned.
  try {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ id: 999999, method: 'Browser.close', params: {} }));
      await sleep(300);
    }
  } catch {
    /* fall through to the forceful path */
  }

  try {
    ws?.close();
  } catch {
    /* ignore */
  }

  killStragglers();

  // The profile cannot go until the browser has let go of its handles.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(profile, { recursive: true, force: true });
      return;
    } catch {
      await sleep(200);
    }
  }
}

// Registered before the browser exists, so no failure path can outrun it.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    shutdown().finally(() => process.exit(130));
  });
}
process.on('uncaughtException', (error) => {
  console.error(error);
  shutdown().finally(() => process.exit(1));
});
process.on('unhandledRejection', (error) => {
  console.error(error);
  shutdown().finally(() => process.exit(1));
});

async function endpoint() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(150);
    }
  }
  throw new Error('Browser did not expose a debugging endpoint');
}

async function main() {
  browser = spawn(EDGE, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    'about:blank',
  ]);

  ws = new WebSocket(await endpoint());
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message.result);
    }
  };

  send = (method, params = {}, sessionId) =>
    new Promise((resolve) => {
      const id = (nextId += 1);
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  await send('Page.enable', {}, sessionId);
  // Edge refuses to size its window below roughly 500px, so narrow viewports
  // have to come from device emulation or a "mobile" screenshot is a lie.
  await send(
    'Emulation.setDeviceMetricsOverride',
    {
      width: Number(width),
      height: Number(height),
      deviceScaleFactor: 1,
      mobile: Number(width) < 700,
    },
    sessionId,
  );
  await send('Page.navigate', { url }, sessionId);
  await sleep(Number(waitMs));

  const { data } = await send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: false },
    sessionId,
  );
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(`wrote ${out}`);
}

try {
  await main();
} finally {
  await shutdown();
}

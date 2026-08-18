import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const demoUrl = process.argv[2] ?? "http://127.0.0.1:4177/";
const outputDirectory = resolve("docs/assets");
const remoteDebuggingPort = 9337;

const browserCandidates = process.env.BROWSER_PATH
  ? [process.env.BROWSER_PATH]
  : [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ];

async function firstExistingPath(paths) {
  for (const path of paths) {
    try {
      await access(path, fsConstants.X_OK);
      return path;
    } catch {
      // Try the next known browser path.
    }
  }
  throw new Error("No supported browser found. Set BROWSER_PATH explicitly.");
}

async function waitForDebugTarget(port, expectedUrl) {
  const deadline = Date.now() + 15_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const target = targets.find(
        (entry) => entry.type === "page" && entry.url.startsWith(expectedUrl),
      );
      if (target?.webSocketDebuggerUrl) {
        return target.webSocketDebuggerUrl;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }

  throw new Error(
    `Browser debug target did not become ready: ${lastError?.message ?? "timeout"}`,
  );
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolvePromise, reject) => {
      this.socket.addEventListener("open", resolvePromise, { once: true });
      this.socket.addEventListener(
        "error",
        () => reject(new Error("CDP WebSocket connection failed")),
        { once: true },
      );
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
  }
  return result.result.value;
}

async function waitForPageReady(client) {
  const deadline = Date.now() + 15_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const ready = await evaluate(
        client,
        "document.readyState === 'complete' && Boolean(document.querySelector('main'))",
      );
      if (ready) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }

  let pageState;
  try {
    pageState = await evaluate(
      client,
      "({ readyState: document.readyState, href: location.href, body: document.body?.innerText?.slice(0, 160) })",
    );
  } catch {
    pageState = undefined;
  }

  throw new Error(
    `Demo page did not become ready: ${lastError?.message ?? "timeout"}; ${JSON.stringify(pageState)}`,
  );
}

async function waitForPaint(client) {
  await evaluate(
    client,
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
  );
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
}

async function setViewport(client, width, height, mobile = false) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height,
  });
}

async function capture(client, filename) {
  await waitForPaint(client);
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const path = join(outputDirectory, filename);
  const bytes = Buffer.from(result.data, "base64");
  await writeFile(path, bytes);
  return { path, bytes: bytes.length };
}

const browserPath = await firstExistingPath(browserCandidates);
const profileDirectory = await mkdtemp(join(tmpdir(), "claustrace-gallery-"));
await mkdir(outputDirectory, { recursive: true });

const browserProcess = spawn(
  browserPath,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--hide-scrollbars",
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${profileDirectory}`,
    "--window-size=1440,1200",
    "about:blank",
  ],
  { stdio: "ignore", windowsHide: true },
);

let client;
try {
  const websocketUrl = await waitForDebugTarget(remoteDebuggingPort, "about:blank");
  client = new CdpClient(websocketUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await setViewport(client, 1440, 1200);
  await client.send("Page.navigate", { url: demoUrl });
  await waitForPageReady(client);

  await evaluate(
    client,
    "Promise.all([document.fonts.ready]).then(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 0); })",
  );

  const captures = [];
  captures.push(await capture(client, "claustrace-overview.png"));

  await evaluate(
    client,
    "Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Run guided dry review')).click()",
  );
  await evaluate(
    client,
    "scrollTo(0, document.querySelector('#evidence').offsetTop)",
  );
  captures.push(await capture(client, "claustrace-cited-review.png"));

  await evaluate(
    client,
    "scrollTo(0, document.querySelector('#sources').offsetTop)",
  );
  captures.push(await capture(client, "claustrace-source-discovery.png"));

  await evaluate(
    client,
    "scrollTo(0, document.querySelector('#packet').offsetTop)",
  );
  await evaluate(
    client,
    "Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Generate draft packet')).click()",
  );
  captures.push(await capture(client, "claustrace-evidence-packet.png"));

  await setViewport(client, 390, 844, true);
  await evaluate(client, "scrollTo(0, 0)");
  captures.push(await capture(client, "claustrace-mobile.png"));

  process.stdout.write(`${JSON.stringify({ ok: true, captures })}\n`);
} finally {
  client?.close();
  browserProcess.kill();
  await new Promise((resolvePromise) => {
    if (browserProcess.exitCode !== null) {
      resolvePromise();
      return;
    }
    browserProcess.once("exit", resolvePromise);
    setTimeout(resolvePromise, 2_000).unref();
  });
  await rm(profileDirectory, { recursive: true, force: true });
}

import { spawn } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CHROME_CANDIDATE_PATHS = [
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((candidate): candidate is string => Boolean(candidate));

const DEFAULT_TIMEOUT_MS = 30_000;
const PDF_POLL_INTERVAL_MS = 250;
const REQUIRED_STABLE_POLLS = 2;

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveChromeExecutablePath() {
  for (const candidate of CHROME_CANDIDATE_PATHS) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "No Chrome or Chromium executable was found. Set CHROME_PATH to enable HTML-to-PDF agreement generation.",
  );
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function terminateProcessGroup(pid: number | undefined) {
  if (!pid) return;

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    return;
  }

  await delay(200);

  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // The process group often exits cleanly before the hard kill is needed.
  }
}

async function waitForPdfOutput(options: {
  pdfPath: string;
  timeoutMs: number;
  getExitState: () => {
    exited: boolean;
    code: number | null;
    signal: NodeJS.Signals | null;
  };
  stderr: () => string;
}) {
  const deadline = Date.now() + options.timeoutMs;
  let lastObservedSize = -1;
  let stablePolls = 0;

  while (Date.now() < deadline) {
    try {
      const details = await stat(options.pdfPath);
      if (details.size > 0) {
        if (details.size === lastObservedSize) {
          stablePolls += 1;
        } else {
          lastObservedSize = details.size;
          stablePolls = 0;
        }

        if (stablePolls >= REQUIRED_STABLE_POLLS) {
          return;
        }
      }
    } catch {
      // Ignore until the file appears.
    }

    const exitState = options.getExitState();
    if (exitState.exited && !(await fileExists(options.pdfPath))) {
      throw new Error(
        `Chrome exited before producing a PDF.${options.stderr() ? ` ${options.stderr()}` : ""}`,
      );
    }

    await delay(PDF_POLL_INTERVAL_MS);
  }

  if (await fileExists(options.pdfPath)) {
    return;
  }

  throw new Error(
    `Timed out while generating the PDF.${options.stderr() ? ` ${options.stderr()}` : ""}`,
  );
}

export async function generatePdfFromHtml(
  html: string,
  options?: {
    timeoutMs?: number;
  },
) {
  const chromePath = await resolveChromeExecutablePath();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "producer-launchpad-pdf-"),
  );
  const htmlPath = path.join(tempDir, "agreement.html");
  const pdfPath = path.join(tempDir, "agreement.pdf");
  const profileDir = path.join(tempDir, "chrome-profile");

  let child: ReturnType<typeof spawn> | null = null;

  try {
    await writeFile(htmlPath, html, "utf8");

    const chromeArgs = [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--metrics-recording-only",
      "--allow-file-access-from-files",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-pdf-header-footer",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=5000",
      `--user-data-dir=${profileDir}`,
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ];

    const stderrChunks: string[] = [];
    const exitState = {
      exited: false,
      code: null as number | null,
      signal: null as NodeJS.Signals | null,
    };

    child = spawn(chromePath, chromeArgs, {
      detached: true,
      stdio: ["ignore", "ignore", "pipe"],
    });

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderrChunks.push(chunk);
      if (stderrChunks.join("").length > 4000) {
        stderrChunks.splice(0, stderrChunks.length - 1);
        stderrChunks[0] = stderrChunks[0].slice(-4000);
      }
    });

    child.on("exit", (code, signal) => {
      exitState.exited = true;
      exitState.code = code;
      exitState.signal = signal;
    });

    child.on("error", (error) => {
      stderrChunks.push(error.message);
    });

    await waitForPdfOutput({
      pdfPath,
      timeoutMs,
      getExitState: () => exitState,
      stderr: () => stderrChunks.join("").trim(),
    });

    const pdfBuffer = await readFile(pdfPath);
    return pdfBuffer;
  } finally {
    await terminateProcessGroup(child?.pid);
    await rm(tempDir, { recursive: true, force: true });
  }
}

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

export type DirectFinalSource = {
  order: number;
  duration: number;
  outputUrl: string;
};

const FFMPEG_RELEASE = "b6.1.1";
const FFMPEG_BINARIES: Record<string, { asset: string; sha256: string }> = {
  "linux:x64": {
    asset: "ffmpeg-linux-x64.gz",
    sha256: "bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa",
  },
  "linux:arm64": {
    asset: "ffmpeg-linux-arm64.gz",
    sha256: "754a678672298bc68156adff58aa7385a592c2b30b1d0ae8750c45c915c4bac0",
  },
};

let ffmpegPromise: Promise<string> | null = null;
const assemblyPromises = new Map<string, Promise<string>>();

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 180);
}

function mediaRoot() {
  const configured = process.env.SCENOVA_MEDIA_DIR?.trim();
  return configured || path.join(homedir(), ".scenova", "media");
}

export function directFinalPath(runId: string) {
  return path.join(mediaRoot(), "direct-render", safeId(runId), "final.mp4");
}

async function executable(file: string) {
  try {
    await access(file, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function runProcess(command: string, args: string[], timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("FINAL_VIDEO_FFMPEG_TIMEOUT"));
    }, timeoutMs);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-12000);
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FINAL_VIDEO_FFMPEG_FAILED:${stderr.slice(-1800)}`));
    });
  });
}

async function systemFfmpeg() {
  const configured = process.env.SCENOVA_FFMPEG_BIN?.trim();
  if (configured && await executable(configured)) return configured;
  try {
    await runProcess("ffmpeg", ["-version"], 5000);
    return "ffmpeg";
  } catch {
    return "";
  }
}

async function downloadFfmpeg() {
  const key = `${process.platform}:${process.arch}`;
  const definition = FFMPEG_BINARIES[key];
  if (!definition) throw new Error(`FINAL_VIDEO_FFMPEG_PLATFORM_UNSUPPORTED:${key}`);

  const binDir = path.join(homedir(), ".scenova", "bin");
  const binPath = path.join(binDir, "ffmpeg-scenova");
  if (await executable(binPath)) return binPath;

  await mkdir(binDir, { recursive: true });
  const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_RELEASE}/${definition.asset}`;
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`FINAL_VIDEO_FFMPEG_DOWNLOAD_HTTP_${response.status}`);
  const compressed = Buffer.from(await response.arrayBuffer());
  if (compressed.byteLength > 90 * 1024 * 1024) throw new Error("FINAL_VIDEO_FFMPEG_DOWNLOAD_TOO_LARGE");
  const digest = createHash("sha256").update(compressed).digest("hex");
  if (digest !== definition.sha256) throw new Error("FINAL_VIDEO_FFMPEG_CHECKSUM_MISMATCH");
  const binary = gunzipSync(compressed);
  const tempPath = `${binPath}.tmp-${process.pid}`;
  await writeFile(tempPath, binary, { mode: 0o755 });
  await chmod(tempPath, 0o755);
  await rename(tempPath, binPath);
  return binPath;
}

async function ensureFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const existing = await systemFfmpeg();
      return existing || downloadFfmpeg();
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }
  return ffmpegPromise;
}

async function downloadVideo(url: string, outputPath: string, origin: string, cookieHeader: string) {
  const absolute = new URL(url, origin).toString();
  const sameOrigin = new URL(absolute).origin === new URL(origin).origin;
  const response = await fetch(absolute, {
    headers: sameOrigin && cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`FINAL_VIDEO_SOURCE_HTTP_${response.status}`);
  if (!response.body) throw new Error("FINAL_VIDEO_SOURCE_EMPTY");

  const reader = response.body.getReader();
  const file = await import("node:fs/promises").then(({ open }) => open(outputPath, "w"));
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 700 * 1024 * 1024) throw new Error("FINAL_VIDEO_SOURCE_TOO_LARGE");
      await file.write(value);
    }
  } finally {
    await file.close();
  }
  if (total < 1024) throw new Error("FINAL_VIDEO_SOURCE_TOO_SMALL");
}

async function assemble(input: {
  runId: string;
  sources: DirectFinalSource[];
  origin: string;
  cookieHeader: string;
}) {
  const finalPath = directFinalPath(input.runId);
  try {
    const existing = await stat(finalPath);
    if (existing.size > 1024) return finalPath;
  } catch {
    // Build it below.
  }

  const sources = [...input.sources]
    .filter((source) => source.outputUrl && source.duration > 0)
    .sort((a, b) => a.order - b.order);
  if (!sources.length) throw new Error("FINAL_VIDEO_SOURCES_REQUIRED");

  const ffmpeg = await ensureFfmpeg();
  const targetDir = path.dirname(finalPath);
  await mkdir(targetDir, { recursive: true });
  const workDir = await mkdtemp(path.join(tmpdir(), "scenova-final-"));
  const tempOutput = path.join(workDir, "final.mp4");
  try {
    const inputFiles: string[] = [];
    for (const source of sources) {
      const filePath = path.join(workDir, `segment-${String(source.order).padStart(3, "0")}.mp4`);
      await downloadVideo(source.outputUrl, filePath, input.origin, input.cookieHeader);
      inputFiles.push(filePath);
    }

    if (inputFiles.length === 1) {
      await rename(inputFiles[0], tempOutput);
    } else {
      const concatFile = path.join(workDir, "concat.txt");
      const concatText = inputFiles.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n");
      await writeFile(concatFile, `${concatText}\n`, "utf8");
      const requestedDuration = sources.reduce((sum, source) => sum + source.duration, 0);
      const commonArgs = [
        "-y",
        "-fflags", "+genpts",
        "-f", "concat",
        "-safe", "0",
        "-i", concatFile,
        "-t", requestedDuration.toFixed(3),
      ];
      try {
        await runProcess(ffmpeg, [
          ...commonArgs,
          "-c", "copy",
          "-avoid_negative_ts", "make_zero",
          "-movflags", "+faststart",
          tempOutput,
        ], 180_000);
      } catch {
        await runProcess(ffmpeg, [
          ...commonArgs,
          "-map", "0:v:0",
          "-map", "0:a?",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "18",
          "-c:a", "aac",
          "-b:a", "192k",
          "-movflags", "+faststart",
          tempOutput,
        ], 300_000);
      }
    }

    const outputStat = await stat(tempOutput);
    if (outputStat.size < 1024) throw new Error("FINAL_VIDEO_OUTPUT_TOO_SMALL");
    const atomicPath = `${finalPath}.tmp-${process.pid}`;
    await writeFile(atomicPath, await readFile(tempOutput));
    await rename(atomicPath, finalPath);
    return finalPath;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function ensureDirectFinalVideo(input: {
  runId: string;
  sources: DirectFinalSource[];
  origin: string;
  cookieHeader: string;
}) {
  const key = safeId(input.runId);
  const existing = assemblyPromises.get(key);
  if (existing) return existing;
  const promise = assemble(input).finally(() => assemblyPromises.delete(key));
  assemblyPromises.set(key, promise);
  return promise;
}

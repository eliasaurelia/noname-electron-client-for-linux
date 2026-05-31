#!/usr/bin/env node

import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const gameDir = path.join(root, "game");
const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log(`Usage:
  npm run sync:game -- --archive <url>
  npm run sync:game -- --from <directory>

Examples:
  npm run sync:game -- --archive https://example.com/noname.zip
  npm run sync:game -- --from /path/to/noname
`);
  process.exit(0);
}

const archiveUrl = readArg("--archive");
const sourceDir = readArg("--from");

if (!archiveUrl && !sourceDir) {
  console.error("Provide --archive <url> or --from <directory>.");
  process.exit(1);
}

if (sourceDir) {
  assertGameDir(sourceDir);
  await resetGameDir();
  await fs.promises.cp(sourceDir, gameDir, { recursive: true, dereference: true });
  console.log(`Copied game files from ${sourceDir}`);
  process.exit(0);
}

const cacheDir = path.join(root, ".cache");
const archiveFile = path.join(cacheDir, path.basename(new URL(archiveUrl).pathname) || "noname.zip");
await fs.promises.mkdir(cacheDir, { recursive: true });
await download(archiveUrl, archiveFile);
await resetGameDir();
extractArchive(archiveFile, gameDir);
normalizeExtractedRoot(gameDir);
assertGameDir(gameDir);
console.log(`Prepared game files in ${gameDir}`);

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function resetGameDir() {
  await fs.promises.rm(gameDir, { recursive: true, force: true });
  await fs.promises.mkdir(gameDir, { recursive: true });
}

function assertGameDir(dir) {
  const indexHtml = path.join(dir, "index.html");
  const appHtml = path.join(dir, "app.html");
  if (!fs.existsSync(indexHtml) && !fs.existsSync(appHtml)) {
    throw new Error(`${dir} is not a complete Noname package: index.html/app.html is missing`);
  }
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    https
      .get(url, (response) => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          file.close();
          fs.rmSync(destination, { force: true });
          download(response.headers.location, destination).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", reject);
  });
}

function extractArchive(archiveFile, destination) {
  if (archiveFile.endsWith(".zip")) {
    run("unzip", ["-q", archiveFile, "-d", destination]);
    return;
  }
  if (archiveFile.endsWith(".tar.gz") || archiveFile.endsWith(".tgz")) {
    run("tar", ["-xzf", archiveFile, "-C", destination]);
    return;
  }
  throw new Error(`Unsupported archive type: ${archiveFile}`);
}

function normalizeExtractedRoot(destination) {
  if (fs.existsSync(path.join(destination, "index.html")) || fs.existsSync(path.join(destination, "app.html"))) {
    return;
  }

  const entries = fs.readdirSync(destination, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (entries.length !== 1) return;

  const nested = path.join(destination, entries[0].name);
  if (!fs.existsSync(path.join(nested, "index.html")) && !fs.existsSync(path.join(nested, "app.html"))) return;

  const tmp = path.join(destination, ".noname-extract");
  fs.renameSync(nested, tmp);
  for (const entry of fs.readdirSync(destination)) {
    if (entry !== ".noname-extract") fs.rmSync(path.join(destination, entry), { recursive: true, force: true });
  }
  for (const entry of fs.readdirSync(tmp)) {
    fs.renameSync(path.join(tmp, entry), path.join(destination, entry));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

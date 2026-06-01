"use strict";

const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const START_PORT = 17890;
const GAME_ENTRY_FILES = ["index.html", "app.html"];
const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".cjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
  [".mp4", "video/mp4"],
  [".txt", "text/plain; charset=utf-8"]
]);

async function startStaticServer(rootDir, startPort = START_PORT) {
  const port = await findFreePort(startPort);
  const server = createStaticServer(rootDir);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return { server, port };
}

function createStaticServer(rootDir) {
  return http.createServer((request, response) => {
    serveStaticFile(rootDir, request, response);
  });
}

function isValidGameDirectory(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  return GAME_ENTRY_FILES.some((file) => fs.existsSync(path.join(dir, file)));
}

function pickEntryFile(dir) {
  return GAME_ENTRY_FILES.find((file) => fs.existsSync(path.join(dir, file))) || null;
}

function serveStaticFile(rootDir, request, response) {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = `/${pickEntryFile(rootDir) || "index.html"}`;

  const requestedPath = path.normalize(path.join(rootDir, pathname));
  if (!requestedPath.startsWith(path.normalize(rootDir + path.sep))) {
    sendText(response, 403, "Forbidden");
    return;
  }

  fs.stat(requestedPath, (statError, stat) => {
    if (statError) {
      sendText(response, 404, "Not found");
      return;
    }

    if (stat.isDirectory()) {
      const entry = pickEntryFile(requestedPath);
      if (!entry) {
        sendText(response, 404, "Not found");
        return;
      }

      serveFile(path.join(requestedPath, entry), response);
      return;
    }

    serveFile(requestedPath, response);
  });
}

function serveFile(filePath, response) {
  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    const contentType = MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    const stream = fs.createReadStream(filePath);

    stream.once("open", () => {
      response.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Access-Control-Allow-Origin": "*"
      });
      stream.pipe(response);
    });

    stream.once("error", (error) => {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }

      sendText(response, 500, "Read error");
    });
  });
}

async function findFreePort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No free localhost port found from ${startPort}`);
}

function canListen(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, "127.0.0.1");
  });
}

function sendText(response, statusCode, body) {
  if (response.headersSent) {
    response.end();
    return;
  }

  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

module.exports = {
  GAME_ENTRY_FILES,
  MIME_TYPES,
  START_PORT,
  createStaticServer,
  isValidGameDirectory,
  pickEntryFile,
  serveFile,
  serveStaticFile,
  startStaticServer
};

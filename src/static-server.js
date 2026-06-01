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
  if (handleFileApi(rootDir, request, response, url)) return;

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

function handleFileApi(rootDir, request, response, url) {
  switch (url.pathname) {
    case "/checkFile":
      sendPathType(rootDir, response, url.searchParams.get("fileName"));
      return true;
    case "/checkDir":
      sendPathType(rootDir, response, url.searchParams.get("dir"));
      return true;
    case "/readFile":
      readFile(rootDir, response, url.searchParams.get("fileName"), false);
      return true;
    case "/readFileAsText":
      readFile(rootDir, response, url.searchParams.get("fileName"), true);
      return true;
    case "/writeFile":
      writeFile(rootDir, request, response);
      return true;
    case "/removeFile":
      removeFile(rootDir, response, url.searchParams.get("fileName"));
      return true;
    case "/getFileList":
      getFileList(rootDir, response, url.searchParams.get("dir"));
      return true;
    case "/createDir":
      createDir(rootDir, response, url.searchParams.get("dir"));
      return true;
    case "/removeDir":
      removeDir(rootDir, response, url.searchParams.get("dir"));
      return true;
    default:
      return false;
  }
}

async function sendPathType(rootDir, response, resourcePath) {
  try {
    sendJson(response, {
      success: true,
      data: await getPathType(resolveResourcePath(rootDir, resourcePath))
    });
  } catch (error) {
    sendJson(response, { success: false, errorMsg: error.message });
  }
}

async function readFile(rootDir, response, resourcePath, asText) {
  try {
    const filePath = resolveResourcePath(rootDir, resourcePath);
    const data = await fs.promises.readFile(filePath, asText ? "utf8" : undefined);
    sendJson(response, {
      success: true,
      data: asText ? data : data.toString("base64")
    });
  } catch (error) {
    sendJson(response, { success: false, errorMsg: error.message });
  }
}

async function writeFile(rootDir, request, response) {
  try {
    const body = JSON.parse(await readRequestBody(request) || "{}");
    const filePath = resolveResourcePath(rootDir, body.path);
    const data = typeof body.data === "string" ? body.data : Uint8Array.from(body.data || []);

    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, data);
    sendJson(response, { success: true });
  } catch (error) {
    sendJson(response, { success: false, errorMsg: error.message });
  }
}

async function removeFile(rootDir, response, resourcePath) {
  try {
    await fs.promises.rm(resolveResourcePath(rootDir, resourcePath), { force: true });
    sendJson(response, { success: true });
  } catch (error) {
    sendJson(response, { success: false, errorMsg: error.message });
  }
}

async function getFileList(rootDir, response, resourcePath) {
  try {
    const entries = await fs.promises.readdir(resolveResourcePath(rootDir, resourcePath), {
      withFileTypes: true
    });
    sendJson(response, {
      success: true,
      data: {
        folders: entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
        files: entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
      }
    });
  } catch (error) {
    sendJson(response, { success: false, errorMsg: error.message });
  }
}

async function createDir(rootDir, response, resourcePath) {
  try {
    await fs.promises.mkdir(resolveResourcePath(rootDir, resourcePath), { recursive: true });
    sendJson(response, { success: true });
  } catch (error) {
    sendJson(response, { success: false, errorMsg: error.message });
  }
}

async function removeDir(rootDir, response, resourcePath) {
  try {
    await fs.promises.rm(resolveResourcePath(rootDir, resourcePath), {
      recursive: true,
      force: true
    });
    sendJson(response, { success: true });
  } catch (error) {
    sendJson(response, { success: false, errorMsg: error.message });
  }
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

async function getPathType(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.isFile()) return "file";
    if (stat.isDirectory()) return "directory";
    return "none";
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EACCES") return "none";
    throw error;
  }
}

function resolveResourcePath(rootDir, resourcePath) {
  const requested = String(resourcePath || "").replace(/\\/g, "/");
  const resolvedRoot = path.resolve(rootDir);
  const resolved = path.resolve(resolvedRoot, requested);

  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new Error("Path is outside the game directory.");
  }

  return resolved;
}

function readRequestBody(request) {
  if (typeof request.on !== "function") return Promise.resolve("");

  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.once("end", () => resolve(body));
    request.once("error", reject);
  });
}

function sendJson(response, payload) {
  if (response.headersSent) {
    response.end();
    return;
  }

  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(payload));
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
  resolveResourcePath,
  serveFile,
  serveStaticFile,
  startStaticServer
};

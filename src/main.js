"use strict";

const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const remoteMain = require("@electron/remote/main");

const APP_NAME = "无名杀";
const APP_DIR_NAME = "noname-electron";
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

let mainWindow = null;
let server = null;
let currentGameDir = null;

remoteMain.initialize();
app.setName(APP_NAME);
app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");
app.commandLine.appendSwitch("disable-site-isolation-trials");

configureWritablePaths();

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  currentGameDir = await resolveGameDirectory();
  createMenu();
  await createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    currentGameDir = await resolveGameDirectory();
    await createMainWindow();
  }
});

app.on("before-quit", () => {
  if (server) server.close();
});

ipcMain.handle("choose-game-dir", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "选择无名杀完整包目录",
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, message: "canceled" };
  }

  const selected = result.filePaths[0];
  if (!isValidGameDirectory(selected)) {
    return {
      ok: false,
      message: "目录中没有 index.html 或 app.html。请选择完整包根目录。"
    };
  }

  const target = getUserGameDir();
  await copyDirectory(selected, target);
  currentGameDir = target;
  await loadGameWindow();
  return { ok: true, gameDir: target };
});

ipcMain.on("get-game-dir", (event) => {
  event.returnValue = currentGameDir && isValidGameDirectory(currentGameDir) ? currentGameDir : "";
});

ipcMain.handle("open-game-dir", async () => {
  const dir = currentGameDir || getUserGameDir();
  await fs.promises.mkdir(dir, { recursive: true });
  await shell.openPath(dir);
  return dir;
});

ipcMain.handle("open-user-data-dir", async () => {
  const dir = app.getPath("userData");
  await fs.promises.mkdir(dir, { recursive: true });
  await shell.openPath(dir);
  return dir;
});

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: "#111214",
    autoHideMenuBar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      nodeIntegrationInSubFrames: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      devTools: true
    }
  });

  remoteMain.enable(mainWindow.webContents);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await loadGameWindow();
}

async function loadGameWindow() {
  if (!mainWindow) return;

  if (!currentGameDir || !isValidGameDirectory(currentGameDir)) {
    await mainWindow.loadFile(path.join(__dirname, "setup.html"));
    return;
  }

  const port = await startStaticServer(currentGameDir);
  const entry = pickEntryFile(currentGameDir);
  await mainWindow.loadURL(`http://127.0.0.1:${port}/${entry}`);
}

function createMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        {
          label: "打开游戏目录",
          click: async () => {
            const dir = currentGameDir || getUserGameDir();
            await fs.promises.mkdir(dir, { recursive: true });
            await shell.openPath(dir);
          }
        },
        {
          label: "打开用户数据",
          click: async () => {
            await shell.openPath(app.getPath("userData"));
          }
        },
        { type: "separator" },
        {
          label: "重新加载",
          accelerator: "CommandOrControl+R",
          click: async () => {
            currentGameDir = await resolveGameDirectory();
            await loadGameWindow();
          }
        },
        {
          label: "开发者工具",
          accelerator: "F12",
          click: () => mainWindow?.webContents.openDevTools({ mode: "detach" })
        },
        { type: "separator" },
        { role: "quit", label: "退出" }
      ]
    },
    {
      label: "视图",
      submenu: [
        { role: "togglefullscreen", label: "全屏" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" }
      ]
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "关于",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: `关于 ${APP_NAME}`,
              message: `${APP_NAME} Electron Client`,
              detail: [
                `Electron ${process.versions.electron}`,
                `Chromium ${process.versions.chrome}`,
                `Node.js ${process.versions.node}`,
                `用户数据: ${app.getPath("userData")}`
              ].join("\n")
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function configureWritablePaths() {
  const appDataRoot = path.join(app.getPath("appData"), APP_DIR_NAME);
  const pathMap = {
    userData: path.join(appDataRoot, "UserData"),
    sessionData: path.join(appDataRoot, "SessionData"),
    cache: path.join(appDataRoot, "Cache"),
    logs: path.join(appDataRoot, "Logs"),
    temp: path.join(os.tmpdir(), APP_DIR_NAME)
  };

  for (const [key, value] of Object.entries(pathMap)) {
    app.setPath(key, value);
  }
}

async function resolveGameDirectory() {
  const envDir = process.env.NONAME_GAME_DIR;
  if (envDir && isValidGameDirectory(envDir)) return envDir;

  const userDir = getUserGameDir();
  if (isValidGameDirectory(userDir)) return userDir;

  const bundledDir = getBundledGameDir();
  if (isValidGameDirectory(bundledDir)) {
    await copyDirectory(bundledDir, userDir);
    return userDir;
  }

  await fs.promises.mkdir(userDir, { recursive: true });
  return null;
}

function getUserGameDir() {
  return path.join(app.getPath("userData"), "game");
}

function getBundledGameDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, "game");
  return path.resolve(__dirname, "..", "game");
}

function isValidGameDirectory(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  return GAME_ENTRY_FILES.some((file) => fs.existsSync(path.join(dir, file)));
}

function pickEntryFile(dir) {
  return GAME_ENTRY_FILES.find((file) => fs.existsSync(path.join(dir, file))) || "index.html";
}

async function startStaticServer(rootDir) {
  if (server) {
    server.close();
    server = null;
  }

  const port = await findFreePort(START_PORT);
  server = http.createServer((request, response) => {
    serveStaticFile(rootDir, request, response);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return port;
}

function serveStaticFile(rootDir, request, response) {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = `/${pickEntryFile(rootDir)}`;

  const requestedPath = path.normalize(path.join(rootDir, pathname));
  if (!requestedPath.startsWith(path.normalize(rootDir + path.sep))) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(requestedPath, (statError, stat) => {
    if (statError) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    if (stat.isDirectory()) {
      const entry = pickEntryFile(requestedPath);
      serveFile(path.join(requestedPath, entry), response);
      return;
    }

    serveFile(requestedPath, response);
  });
}

function serveFile(filePath, response) {
  const contentType = MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
  const stream = fs.createReadStream(filePath);

  stream.once("error", () => {
    response.writeHead(500);
    response.end("Read error");
  });

  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Access-Control-Allow-Origin": "*"
  });
  stream.pipe(response);
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

async function copyDirectory(source, destination) {
  await fs.promises.rm(destination, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  await fs.promises.cp(source, destination, {
    recursive: true,
    dereference: true,
    force: true,
    filter: (entry) => !entry.split(path.sep).includes(".git")
  });
}

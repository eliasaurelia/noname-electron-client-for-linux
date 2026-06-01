"use strict";

const { ipcRenderer } = require("electron");

function exposeWindowGlobal(name, value, shouldExpose) {
  if (shouldExpose) {
    Object.defineProperty(window, name, {
      value,
      writable: true,
      configurable: true
    });
  }
}

exposeWindowGlobal("require", require, typeof window.require !== "function");
exposeWindowGlobal(
  "process",
  typeof process !== "undefined" ? process : undefined,
  typeof process !== "undefined" && typeof window.process === "undefined"
);
exposeWindowGlobal(
  "Buffer",
  typeof Buffer !== "undefined" ? Buffer : undefined,
  typeof Buffer !== "undefined" && typeof window.Buffer === "undefined"
);

const gameDir = ipcRenderer.sendSync("get-game-dir");
if (typeof gameDir === "string" && gameDir.length > 0) {
  Object.defineProperty(window, "__dirname", {
    value: gameDir,
    writable: true,
    configurable: true
  });
}

window.nonameClient = {
  chooseGameDir: () => ipcRenderer.invoke("choose-game-dir"),
  openGameDir: () => ipcRenderer.invoke("open-game-dir"),
  openUserDataDir: () => ipcRenderer.invoke("open-user-data-dir")
};

window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.dataset.nonameElectron = "true";
});

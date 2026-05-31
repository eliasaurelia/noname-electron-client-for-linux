"use strict";

const { ipcRenderer } = require("electron");

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

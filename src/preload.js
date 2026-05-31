"use strict";

const { ipcRenderer } = require("electron");

window.nonameClient = {
  chooseGameDir: () => ipcRenderer.invoke("choose-game-dir"),
  openGameDir: () => ipcRenderer.invoke("open-game-dir"),
  openUserDataDir: () => ipcRenderer.invoke("open-user-data-dir")
};

window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.dataset.nonameElectron = "true";
});

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nonameClient", {
  chooseGameDir: () => ipcRenderer.invoke("choose-game-dir"),
  openGameDir: () => ipcRenderer.invoke("open-game-dir"),
  openUserDataDir: () => ipcRenderer.invoke("open-user-data-dir")
});

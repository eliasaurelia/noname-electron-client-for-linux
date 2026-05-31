"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const preloadPath = path.join(root, "src", "preload.js");

test("preload exposes the resolved Noname game directory as window.__dirname", () => {
  const calls = [];
  const gameDir = "/tmp/noname-game";
  const window = {
    addEventListener() {}
  };
  const electron = {
    ipcRenderer: {
      invoke() {},
      sendSync(channel) {
        calls.push(channel);
        return gameDir;
      }
    }
  };

  vm.runInNewContext(fs.readFileSync(preloadPath, "utf8"), {
    require(moduleId) {
      if (moduleId === "electron") return electron;
      throw new Error(`Unexpected module: ${moduleId}`);
    },
    window
  }, { filename: preloadPath });

  assert.deepEqual(calls, ["get-game-dir"]);
  assert.equal(window.__dirname, gameDir);
});

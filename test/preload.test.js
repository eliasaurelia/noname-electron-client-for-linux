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

test("preload exposes Node globals required by the upstream entry loader", () => {
  const gameDir = "/tmp/noname-game";
  const processGlobal = {
    platform: "linux",
    versions: {
      electron: "42.3.0"
    }
  };
  const bufferGlobal = function Buffer() {};
  const fsModule = {};
  const pathModule = {};
  const window = {
    addEventListener() {}
  };
  const electron = {
    ipcRenderer: {
      invoke() {},
      sendSync() {
        return gameDir;
      }
    }
  };

  function rendererRequire(moduleId) {
    if (moduleId === "electron") return electron;
    if (moduleId === "fs") return fsModule;
    if (moduleId === "path") return pathModule;
    throw new Error(`Unexpected module: ${moduleId}`);
  }

  vm.runInNewContext(fs.readFileSync(preloadPath, "utf8"), {
    Buffer: bufferGlobal,
    process: processGlobal,
    require: rendererRequire,
    window
  }, { filename: preloadPath });

  assert.equal(window.require, rendererRequire);
  assert.equal(window.require("path"), pathModule);
  assert.equal(window.process, processGlobal);
  assert.equal(window.Buffer, bufferGlobal);
});

test("preload hides sandboxed require when core Node modules are unavailable", () => {
  const window = {
    require() {},
    addEventListener() {}
  };
  const electron = {
    ipcRenderer: {
      invoke() {},
      sendSync() {
        return "/tmp/noname-game";
      }
    }
  };

  function sandboxRequire(moduleId) {
    if (moduleId === "electron") return electron;
    throw new Error(`module not found: ${moduleId}`);
  }

  vm.runInNewContext(fs.readFileSync(preloadPath, "utf8"), {
    require: sandboxRequire,
    window
  }, { filename: preloadPath });

  assert.equal(window.require, undefined);
});

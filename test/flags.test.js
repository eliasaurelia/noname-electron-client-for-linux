"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  FLAGS_FILE_NAME,
  applyConfiguredFlags,
  getFlagsFilePath,
  loadConfiguredFlags,
  parseFlagConfig,
  readConfiguredFlags
} = require("../src/flags");

test("flags config path uses XDG_CONFIG_HOME when set", () => {
  const configHome = "/tmp/noname-config";

  assert.equal(
    getFlagsFilePath({ XDG_CONFIG_HOME: configHome }, "/home/user"),
    path.join(configHome, FLAGS_FILE_NAME)
  );
});

test("flags config path falls back to ~/.config", () => {
  assert.equal(
    getFlagsFilePath({}, "/home/user"),
    path.join("/home/user", ".config", FLAGS_FILE_NAME)
  );
});

test("flags parser ignores blank lines and comments", () => {
  const flags = parseFlagConfig(`
# Wayland options
--ozone-platform-hint=auto

   # another comment
--enable-features=WaylandWindowDecorations
`);

  assert.deepEqual(flags, [
    "--ozone-platform-hint=auto",
    "--enable-features=WaylandWindowDecorations"
  ]);
});

test("flags parser keeps quoted values as one argument", () => {
  const flags = parseFlagConfig('--js-flags="--max-old-space-size=4096 --expose-gc"');

  assert.deepEqual(flags, [
    "--js-flags=--max-old-space-size=4096 --expose-gc"
  ]);
});

test("missing flags config returns no flags", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "noname-flags-"));

  assert.deepEqual(readConfiguredFlags(path.join(root, "missing.conf")), []);
});

test("configured flags are appended to Electron command line", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "noname-flags-"));
  const flagsPath = path.join(root, FLAGS_FILE_NAME);
  await fs.writeFile(flagsPath, "--disable-gpu\n--force-device-scale-factor=1\n", "utf8");

  const appended = [];
  const flags = applyConfiguredFlags({
    appendArgument(flag) {
      appended.push(flag);
    }
  }, readConfiguredFlags(flagsPath));

  assert.deepEqual(flags, ["--disable-gpu", "--force-device-scale-factor=1"]);
  assert.deepEqual(appended, flags);
});

test("loader reads user config and appends configured flags", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "noname-flags-"));
  await fs.writeFile(path.join(root, FLAGS_FILE_NAME), "--enable-logging\n", "utf8");

  const appended = [];
  const flags = loadConfiguredFlags({
    appendArgument(flag) {
      appended.push(flag);
    }
  }, {
    env: { XDG_CONFIG_HOME: root },
    homeDir: "/unused",
    logger: null
  });

  assert.deepEqual(flags, ["--enable-logging"]);
  assert.deepEqual(appended, flags);
});

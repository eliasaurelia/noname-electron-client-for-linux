"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const FLAGS_FILE_NAME = "noname-electron-flags.conf";

function getFlagsFilePath(env = process.env, homeDir = os.homedir()) {
  const configHome = env.XDG_CONFIG_HOME || path.join(homeDir, ".config");
  return path.join(configHome, FLAGS_FILE_NAME);
}

function parseFlagConfig(content) {
  return content
    .split(/\r?\n/)
    .flatMap((line, index) => parseFlagLine(line, index === 0))
    .filter((flag) => flag.startsWith("--"));
}

function readConfiguredFlags(filePath = getFlagsFilePath()) {
  try {
    return parseFlagConfig(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
}

function applyConfiguredFlags(commandLine, flags) {
  for (const flag of flags) {
    commandLine.appendArgument(flag);
  }
  return flags;
}

function loadConfiguredFlags(commandLine, options = {}) {
  const filePath = options.filePath || getFlagsFilePath(options.env, options.homeDir);
  const logger = options.logger || console;

  try {
    return applyConfiguredFlags(commandLine, readConfiguredFlags(filePath));
  } catch (error) {
    if (logger && typeof logger.warn === "function") {
      logger.warn(`Unable to read ${FLAGS_FILE_NAME}: ${error.message}`);
    }
    return [];
  }
}

function parseFlagLine(line, stripBom) {
  const normalized = stripBom ? line.replace(/^\uFEFF/, "") : line;
  const trimmed = normalized.trim();
  if (!trimmed || trimmed.startsWith("#")) return [];

  return splitShellWords(trimmed);
}

function splitShellWords(value) {
  const words = [];
  let word = "";
  let quote = "";
  let escaping = false;

  for (const char of value) {
    if (escaping) {
      word += char;
      escaping = false;
      continue;
    }

    if (char === "\\" && quote !== "'") {
      escaping = true;
      continue;
    }

    if ((char === "\"" || char === "'") && (!quote || quote === char)) {
      quote = quote ? "" : char;
      continue;
    }

    if (!quote && /\s/.test(char)) {
      if (word) {
        words.push(word);
        word = "";
      }
      continue;
    }

    word += char;
  }

  if (escaping) word += "\\";
  if (word) words.push(word);
  return words;
}

module.exports = {
  FLAGS_FILE_NAME,
  applyConfiguredFlags,
  getFlagsFilePath,
  loadConfiguredFlags,
  parseFlagConfig,
  readConfiguredFlags
};

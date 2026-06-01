"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { serveStaticFile } = require("../src/static-server");

test("static server returns 404 for a directory without an entry file", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "noname-static-"));
  await fs.mkdir(path.join(root, "noname", "game"), { recursive: true });
  await fs.writeFile(path.join(root, "index.html"), "<!doctype html>", "utf8");

  const response = await serve(root, "/noname/game/");

  assert.equal(response.statusCode, 404);
  assert.equal(response.body, "Not found");
});

function serve(root, url) {
  return new Promise((resolve) => {
    const response = {
      body: "",
      headers: null,
      headersSent: false,
      statusCode: null,
      writeHead(statusCode, headers) {
        assert.equal(this.headersSent, false);
        this.headersSent = true;
        this.statusCode = statusCode;
        this.headers = headers;
      },
      end(chunk = "") {
        this.body += chunk;
        resolve(this);
      }
    };

    serveStaticFile(root, { url }, response);
  });
}

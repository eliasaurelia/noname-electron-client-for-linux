import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await fs.promises.readFile(path.join(root, "package.json"), "utf8"));

const errors = [];
if (pkg.devDependencies.electron !== "42.3.3") {
  errors.push(`electron must be pinned to 42.3.3, got ${pkg.devDependencies.electron}`);
}

const targets = pkg.build?.linux?.target?.flatMap((target) => target.target ?? target) ?? [];
for (const expected of ["deb", "AppImage"]) {
  if (!targets.includes(expected)) errors.push(`missing linux target: ${expected}`);
}

for (const file of ["src/main.js", "src/preload.js", "src/setup.html", "src/setup-preload.js"]) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`);
}

if (!fs.existsSync(path.join(root, "assets", "icon.png"))) {
  errors.push("missing assets/icon.png; run npm run prepare:icon");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("verification passed");

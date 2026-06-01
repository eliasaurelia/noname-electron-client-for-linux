# 无名杀 Electron Debian Client

This repository builds a Debian 13 compatible Electron client for Noname.
It follows the archived `nonameShijian/noname` launcher idea while using the
current stable Electron line, local user-data storage, and Linux package output.

## Versions

- Electron: `42.3.0`
- Targets: Debian package (`.deb`) and AppImage (`.AppImage`)
- Tested host target: Debian GNU/Linux 13 `trixie`, x64
- Runtime fix in `1.0.3`: the local HTTP server now returns a single
  `404/500` response for missing or unreadable files, preventing
  `ERR_HTTP_HEADERS_SENT` crashes in the Electron main process.
- Runtime fix in `1.0.2`: preload now exposes `window.require`,
  `window.process`, and `window.Buffer`, so current `libnoname/noname`
  releases route through the upstream Node initializer and install file-system
  helpers such as `game.checkFile` and `game.checkDir`.
- Runtime fix in `1.0.1`: imported `libnoname/noname` release files are exposed
  to the renderer as `window.__dirname`, so the upstream Node runtime reads from
  the imported game directory instead of the packaged Electron `app.asar`.

## Build

```bash
npm install
npm run verify
npm run build
```

Build artifacts are written to `release/`.

## Include the game content

The package can run without bundled game content and will open a setup screen.
For a self-contained installer, place a complete Noname web package in `game/`
before running `npm run build`.

Expected entries:

- `game/index.html`, or
- `game/app.html`

You can also run `npm run sync:game -- --help` to see the helper for downloading
and unpacking a release archive into `game/`.

## Runtime game directory

At launch, the client resolves the game directory in this order:

1. `NONAME_GAME_DIR`, if set and valid.
2. The writable per-user directory under Electron user data.
3. A bundled `resources/game` directory, copied into user data on first launch.

The app keeps writes out of `/opt`, so Debian packages can be installed
system-wide without making the game directory read-only for the player.

## Latest libnoname release notes

Recent `libnoname/noname` releases use a Vite-built entry, a module service
worker, and Node runtime helpers that expect `__dirname` to point at the game
root. They also detect Electron's Node runtime through `window.require`. The
client serves the imported directory over local HTTP and exposes the required
runtime globals through preload before the game scripts run.

Do not patch imported release files to work around startup problems. Fix the
Electron shell, rebuild, and re-import only when the upstream release itself
changes.

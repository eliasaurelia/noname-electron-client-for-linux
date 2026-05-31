# 无名杀 Electron Debian Client

This repository builds a Debian 13 compatible Electron client for Noname.
It follows the archived `nonameShijian/noname` launcher idea while using the
current stable Electron line, local user-data storage, and Linux package output.

## Versions

- Electron: `42.3.0`
- Targets: Debian package (`.deb`) and AppImage (`.AppImage`)
- Tested host target: Debian GNU/Linux 13 `trixie`, x64

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

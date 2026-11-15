# hive.ausbit.dev source

This is the main source repository for hive.ausbit.dev

You can find the project announcement post here
https://hive.ausbit.dev/@ausbitbank/hive-ausbit-dev-an-open-source-hive-block-explorer-post-viewer-and-more

## Requirements

- [Bun](https://bun.sh) (the repo ships a `bun.lockb` lockfile)
- Node.js 18 or newer (tested on Node 26)

## Development

```bash
bun install
bun run dev     # dev server on http://localhost:8080
```

## Production build

```bash
bun run build   # static site in dist/spa
```

The `dev` and `build` scripts run Quasar with `--openssl-legacy-provider`
because the Quasar 1.x / webpack 4 toolchain relies on MD4 hashing, which
modern Node.js disables by default.

## Deployment

The site is served by nginx from `/var/www/hive.ausbit.dev` on `hurgenburgen`
(history-mode fallback to `index.html`). After a successful build:

```bash
rsync -avz --delete dist/spa/ hurgenburgen:/var/www/hive.ausbit.dev/
```

Pull requests, feedback and issues are welcomed

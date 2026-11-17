# hive.ausbit.dev

An open-source block explorer and toolkit for the [Hive](https://hive.io) blockchain.

Browse blocks, transactions, accounts, wallets, posts, proposals, witnesses and the
internal market. Signing is done with Hive Keychain or the built-in encrypted
SmartLock.

## Stack

- Vue 3 (Options API)
- Quasar 2 + Quasar CLI (Vite)
- Pinia
- Vue Router 5
- `@hiveio/hive-js` for chain reads and transaction construction
- A fetch-based Hive-Engine client and CoinGecko for token/market data

## Requirements

- [Bun](https://bun.sh) 1.2+ (the repo ships a Bun lockfile)
- Node.js 20 or newer

## Development

```bash
bun install
bun run dev     # dev server on http://localhost:8080
```

## Production build

```bash
bun run build   # static site in dist/spa
```

## Lint

```bash
bun run lint
bun run lint:fix
```

## Deployment

The site is served by nginx from `/var/www/hive.ausbit.dev` on `hurgenburgen`
(history-mode fallback to `index.html`).

Use the deploy script. It lints, builds, creates a timestamped tarball backup of
the live site, uploads the build to a staging directory, then rsyncs it into
place:

```bash
./scripts/deploy.sh
```

Every deploy prints the backup path and the matching rollback command. To revert:

```bash
./scripts/rollback.sh ~/hive-backups/hive.ausbit.dev-<timestamp>.tar.gz
```

The rollback script first snapshots the current (bad) deployment as
`hive-backups/pre-rollback-<timestamp>.tar.gz`, so a rollback is itself
reversible. Override the defaults for another host with `REMOTE` and
`REMOTE_DIR`.

## History

The 2026 revamp modernized the abandoned Quasar 1 / Vue 2 / webpack codebase.
It was merged to `master` on 2026-11-17; the pre-revamp state is preserved as
the `archive/pre-revamp-2026-11-17` tag. See
[`docs/MODERNIZATION.md`](docs/MODERNIZATION.md) for the audit, the removed
features and the migration notes.

Pull requests, feedback and issues are welcome.

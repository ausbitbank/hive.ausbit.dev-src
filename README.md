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
- Hive-Engine (via `sscjs`) and CoinGecko for token/market data

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
(history-mode fallback to `index.html`). After a successful build:

```bash
rsync -avz --delete dist/spa/ hurgenburgen:/var/www/hive.ausbit.dev/
```

## Branch history

The `revamp/vue3-quasar2` branch modernizes the abandoned Quasar 1 / Vue 2 /
webpack codebase. See [`docs/MODERNIZATION.md`](docs/MODERNIZATION.md) for the
audit, the removed features and the migration notes.

Pull requests, feedback and issues are welcome.

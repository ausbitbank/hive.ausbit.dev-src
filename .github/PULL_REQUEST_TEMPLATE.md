<!--
  Thanks for the pull request. Keep it focused and describe the verification.
  Delete sections that do not apply.
-->

## What changed

<!-- A short description and the reason for the change. -->

## Affected routes and flows

<!-- For example: /@account/wallet, /markets, the composer, the signing queue. -->

## Verification

- [ ] `bun run lint`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `bun run test:e2e` (or `bun run test:e2e:full` for UI, accessibility, PWA or performance work)
- [ ] `bun run perf:check` (if a route bundle or startup path changed)
- [ ] Browser smoke of the affected routes, including stale/error states
- [ ] Axe check at 1440px and 390px (for visible UI changes)

## Screenshots

<!-- Before/after images for visible changes. Remove private account data. -->

## Documentation

- [ ] User-facing or deployment docs updated
- [ ] `docs/workstreams/W*.md` record added or updated for substantial work

## Notes

<!-- Known limitations, deployment steps, rollback notes or follow-ups. -->

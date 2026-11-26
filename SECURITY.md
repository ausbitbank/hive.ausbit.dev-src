# Security policy

## Supported version

The `master` branch is the supported version. Production deploys from it to
<https://banksia.io>.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through GitHub's
[security advisory form](https://github.com/ausbitbank/hive.ausbit.dev-src/security/advisories/new)
or email **ausbitbank@gmail.com** with:

- A description of the issue and its impact.
- Reproduction steps or a proof of concept.
- The affected route, browser and, if relevant, wallet (Keychain, HiveAuth or
  SmartLock).
- Whether any key material or funds could be exposed.

You will get an acknowledgement as soon as practical. This is a volunteer
project, so there is no bug bounty and no guaranteed response time. Please give
a reasonable window for a fix before publishing details.

## Scope

The highest-value targets are:

- Client-side key handling: SmartLock encryption and storage, in-memory key
  lifetime, queue persistence and logout/lock behaviour.
- HiveAuth session handling, relay resume and signing intent.
- Post, comment and profile HTML sanitisation, embed allowlists and JSON-LD
  generation.
- CSP, response headers, the nginx origin configuration and the Cloudflare
  metadata Worker.
- Authority escalation or an action that broadcasts without explicit review.

The detailed threat model and header policy live in
[docs/SECURITY.md](docs/SECURITY.md).

## Testing against production

Use a dedicated test account and small amounts. Do not attempt to access other
users' accounts, keys or funds, and do not run disruptive load tests against the
public site or public Hive API nodes. If you need a safe target, run the app
locally with the test suite fixtures.

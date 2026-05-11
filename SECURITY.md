# Security policy

## Reporting a vulnerability

Please **do not** open a public GitHub Issue for security-sensitive reports. Instead, use [GitHub's private vulnerability reporting](https://github.com/akash-network/console-air/security/advisories/new) so we can triage and patch before disclosure.

For non-sensitive dependency advisories, you can either open a regular issue or let the automated audit (below) pick it up.

## Automated dependency audit

`.github/workflows/security-audit.yml` runs `npm audit --audit-level=high` on three triggers:

- **Nightly** at 06:00 UTC.
- **On every pull request** targeting `main`. The check fails (blocking merge) if the PR introduces a new high or critical advisory.
- **On manual dispatch** via the Actions tab.

When a high or critical advisory is found on a scheduled or manual run, the workflow opens — or updates — a single tracking issue identified by an HTML marker comment, so nightly runs don't spam. When `npm audit` is clean again, the tracker is auto-closed with a ✅ comment.

The job summary always includes a Markdown table of high+critical findings with advisory links and fix availability, rendered by `.github/workflows/scripts/audit-summary.mjs`.

## Severity gate: high and critical only

The audit gate is set to `--audit-level=high`. **Moderate and low findings are intentionally ignored** for alerting purposes; they still appear in `npm audit` output but don't trigger PR failures or tracker issues.

### Accepted low-severity residuals

A subset of low-severity advisories cannot be eliminated upstream without dropping wallet functionality. They are documented here so reviewers don't try to "fix" them in isolation.

| Source chain | Why unfixable |
|---|---|
| `elliptic`, `tiny-secp256k1`, `bip32` | The `elliptic` advisory range is `*` — every published version is flagged. No alternative is wired into `@cosmjs/crypto` / `@keplr-wallet/crypto`. |
| `@cosmjs/{amino,crypto}` (under `@cosmsnap/snapper`) | Depend transitively on `elliptic`. |
| `@cosmsnap/snapper`, `@keplr-wallet/{common,cosmos,crypto}`, `@chain-registry/keplr` | Same. The "fix" npm suggests is downgrading `@cosmos-kit/keplr` to `0.32.x`, which removes current wallet integration. |
| `@cosmos-kit/{core,react,react-lite,cosmos-extension-metamask,cosmostation-extension,keplr,keplr-extension,keplr-mobile,walletconnect}` | All transitively flagged via the chain above. |

If any of these escalates to **high** or **critical** in the future, the audit gate will catch it and the tracking issue will reopen automatically.

## Supply-chain hardening

- All workspace `package.json` files pin direct dependencies to exact versions (no `^` / `~`). See [`.npmrc`](.npmrc) which enforces `save-exact=true` for future `npm install <pkg>` calls.
- `npm ci` is used in CI so installs are reproducible from `package-lock.json`.

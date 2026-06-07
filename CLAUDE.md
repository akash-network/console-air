# console-air — agent guide

Self-custody (AEP-84) fork of Akash Console. Only app is `apps/deploy-web` (there is **no `apps/api`**).

## Git conventions

**Branch names: `<type>/<short-kebab-description>`.** Examples: `feat/forward-sdl-reclamation`,
`chore/bump-chain-sdk-alpha-34`, `fix/provider-dedup-alias-resolution`. `<type>` is the
conventional-commit type (`feat|fix|chore|docs|ci|refactor|test|perf|style|build|revert`).

- **Do NOT use Linear's auto-generated `gitBranchName`** (e.g. `<author>/con-434-l-15-...`),
  even when a handoff, plan, or Linear issue suggests it. Reference the CON issue in the **commit
  message and PR body**, not the branch name.
- One PR per Linear issue. If issue B depends on issue A, stack B's branch on A's and set the PR base
  to A's branch.

**Commits are linted** (husky `commit-msg` → commitlint, conventional-commits):
- Scope must be one of: `network, wallet, sdl, user, auth, billing, provider, deployment, indexer,
  certificate, dx, config, stats, release, ci, repo, styling, observability, analytics, template,
  notifications, alert, notification-channel, jwt, log-collector, bid, onboarding, managed-wallet`.
  There is **no `deps` scope** — use `chore(repo)` for dependency bumps.
- Body lines must be **≤ 100 chars**.
- A husky `pre-commit` hook regenerates `packages/net` config — expect it to run on every commit.

## Dependencies

`.npmrc` sets `min-release-age=7`: npm refuses any package version published in the last 7 days.
Installing a newer version needs `npm_config_min_release_age=0 npm install` (and CI will hit the same
gate). Confirm with the user before overriding this supply-chain policy.

## Tests

Frontend tests are Vitest. From `apps/deploy-web`: `npm run test:unit`. Follow the `console-tests`
skill conventions (the `setup()` pattern, `describe(Subject.name, ...)`, `mock<T>()` from
vitest-mock-extended). Specs are co-located (`*.spec.ts` / `*.spec.tsx`).

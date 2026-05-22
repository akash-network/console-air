## Contribution Guidelines for Akash Console Air

### Overview

Thank you for considering contributing to `@akashnetwork/console-air` — the self-custody fork of the Akash Console deploy-web app. These guidelines ensure that all contributions are valuable, feasible, and maintain our project's quality standards.

### I. Before Contributing

1. **Open an Issue**: Before making changes, open an issue to discuss your proposed feature or bug fix.
2. **Describe Clearly**: Provide a clear description of the change, including any required information specified in the issue labels.

### II. Pull Requests

1. **Single Purpose**: Each PR should address one specific feature or bug.
2. **Keep it Small**: Limit changes per PR. Multiple small PRs are preferred over large ones.
3. **Link to Issue**: Reference the related issue in your PR description.

### III. Repo Layout

This repo contains a single Next.js application under `/apps/deploy-web` and shared workspaces under `/packages/*`. The fork strips managed-wallet/custodial features (Auth0, custodial wallet popup, user accounts backend, alerts, API keys, Git OAuth deploy). Authentication is wallet-only (Keplr, Cosmostation, MetaMask Cosmos extension).

Installing an npm package must be done at the root with the workspace flag, e.g.:

```
npm i -w ./apps/deploy-web name-of-the-package@version
```

If CI fails with `Missing: <pkg> from lock file`, your install pruned a Linux-only optional dependency (typically a rolldown or sharp variant) that `npm ci` needs on the CI runner. Run `npm run deps:relock` to do a clean re-resolve and commit the resulting `package-lock.json`. Avoid running this preemptively — it produces a large diff that's harder to security-review.

### IV. Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) standard:

```
fix: resolved bug in wallet connect

# Notes:
# If your commit targets a specific feature/domain, add a scope:

feat(wallet): support metamask cosmos extension
```

### V. Code Quality and Readability

- **Apply Best Practices for Code Readability**: Ensure your code follows established best practices for coding standards, documentation, and formatting.
- **Include Unit Tests (When Applicable)**: Verifiable unit tests aid in maintaining code quality and prevent additional bugs from being introduced.
- **Linting**: Run `npm run lint` to make sure your code is properly formatted.

### Contribution Process Overview

- Open an issue describing the bug or feature you'd like to address
- Once issues are created and reviewed, make changes while following the mentioned guidelines
- Once you're satisfied with your contributions, submit a pull request according to our guidelines
- A Core Developer Team member will assist and review your included changes accordingly

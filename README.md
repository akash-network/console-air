<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/deploy-web/public/images/console-air-logo-dark.svg">
    <img alt="Akash Console Air" src="apps/deploy-web/public/images/console-air-logo-light.svg" width="420">
  </picture>
</p>

Self-hostable, self-custody crypto wallet UI for deploying on the [Akash Network](https://akash.network).

## Requirements

- **Node.js** >= 20
- **npm** >= 11

## Setup

```bash
git clone git@github.com:akash-network/console-air.git
cd console-air
npm install
```

## Run

From the repo root:

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000) (or `3001` if `3000` is in use).

That's it — Console Air ships with production defaults pointing at the Akash hosted Console infrastructure (`console-api.akash.network`, `stats.akash.network`, the public chain REST endpoints, etc.), so **no env config is required to run the app**.

## Build & Production

```bash
npm run build
npm --workspace apps/deploy-web run start
```

## Environment overrides (optional)

If you want to point an instance at your own Console API, provider proxy, or chain nodes, env files live under [apps/deploy-web/env/](apps/deploy-web/env/) and are gitignored:

```bash
cp apps/deploy-web/env/.env.sample apps/deploy-web/env/.env.local
```

Every variable in the sample is optional and documents its production default; uncomment only the ones you need to override.

## Project Layout

This is an npm-workspaces monorepo:

- [apps/deploy-web/](apps/deploy-web/) — the Next.js console UI
- [packages/](packages/) — shared libraries consumed by the app

## Versions

- Cosmos SDK target: **53**

## License

Apache-2.0

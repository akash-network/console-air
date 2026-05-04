# Self-hosting Console Air

Console Air is an npm-workspaces monorepo with a single Next.js app at [`apps/deploy-web/`](../apps/deploy-web/). There's nothing special about deploying it — anything that can host a Next.js app can host Console Air.

This guide covers two paths: running it locally for personal use, and deploying it behind your own domain for shared or production use.

## Run it locally

Prerequisites:

- Node.js >= 20
- npm >= 11

Clone, install, run:

```bash
git clone https://github.com/akash-network/console-air.git
cd console-air
npm install
npm run dev
```

Console Air starts on `http://localhost:3000` (or `3001` if `3000` is busy). Connect a wallet, point it at the RPC node of your choice if you want (see [Self-custody guide](./self-custody.md)), and deploy.

For most self-custody users, this is enough. You don't need a server — your browser is the client, your wallet signs transactions, and the chain is the source of truth.

## Deploy behind your own domain

If you want to share an instance with your team or run a public mirror, the natural place to host Console Air is **on Akash itself**. The deployable artifact is the `apps/deploy-web` workspace — build a container image around the production start command and write an SDL pointing at it:

```bash
npm run build
npm --workspace apps/deploy-web run start
```

If you'd rather run it on your own infrastructure, the same build runs behind any reverse proxy you already operate (Caddy, Traefik, nginx, Cloudflare Tunnel). Console Air is a stock Next.js app — it'll run anywhere Node.js runs — but Akash is the recommended host for a tool whose whole point is to use Akash.

## Configuration

Out of the box, Console Air ships with production defaults pointing at the Akash hosted Console infrastructure (`console-api.akash.network`, `stats.akash.network`, the public chain REST endpoints). **No env config is required to run it.**

If you want to point at your own Console API, provider proxy, or chain nodes, env files live under [`apps/deploy-web/env/`](../apps/deploy-web/env/) and are gitignored:

```bash
cp apps/deploy-web/env/.env.sample apps/deploy-web/env/.env.local
```

Every variable in the sample is optional and documents its production default. Uncomment only the ones you need to override.

You can also override RPC and API endpoints at runtime from inside the UI via **App Settings** → **Network** → **Custom Node** — see [Self-custody guide](./self-custody.md).

## Updating

```bash
git pull
npm install
npm run build
# restart your process
```

Console Air follows semver. Breaking changes (network removals, configuration renames) get called out in the release notes. Local data — saved deployments, certificates, favorites — lives in browser localStorage and is preserved across upgrades unless explicitly noted.

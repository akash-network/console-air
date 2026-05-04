# Self-custody guide

Self-custody on Console Air means three things you control yourself:

1. **Your wallet** — you sign every transaction with your own keys
2. **Your nodes** — you decide which RPC and API endpoints the UI talks to
3. **Your certificates** — the deployment certificates that prove you own a deployment live in your browser, exportable and revocable on your terms

This guide walks through each.

## Connect your wallet

Console Air uses [Cosmos Kit](https://cosmoskit.com/) to connect to wallets. Out of the box it supports:

- Keplr (browser extension and mobile)
- Cosmostation
- MetaMask (via the Cosmos extension snap)

Click **Connect Wallet** in the top-right and pick your wallet. Approve the connection in the wallet UI. You're connected.

If you've used Akash Console before, the wallet you connected there will still work — the address is the same; the chain is the same.

### Multiple wallets

Console Air remembers every wallet you've connected. Switch between them from the wallet dropdown in the top-right. Local data (favorites, custom settings) is shared across wallets in the same browser; deployments and certificates are scoped per-address.

### What "self-custodial" means here

Console Air never sees your private keys. Every transaction is signed inside your wallet (Keplr's extension, your hardware wallet, etc.) and Console Air only ever holds the signed payload long enough to broadcast it. Console Air also doesn't run any signing service of its own — there's no "managed signer" between you and the chain.

The only key material Console Air stores in your browser is for **deployment certificates** (see below). Those aren't your wallet keys; they're cert/key pairs scoped to a single deployment's shell and log access.

## Configure your nodes

Console Air ships with sensible default RPC and API endpoints for each Akash network (`mainnet`, `sandbox`, `testnet-bme`). For most users, the defaults are fine.

If you run your own Akash full node — or you trust a specific public RPC more than the default — point Console Air at it:

1. **App Settings** → **Network**
2. Toggle **Custom Node** on
3. Paste your RPC URL (e.g. `https://your-node.example.com:443`)
4. Console Air will probe the endpoint, show its latency, and start using it for chain queries and tx broadcasts

Custom node settings are persisted in localStorage, so they survive browser restarts. Export Local Data captures them, so they migrate with you (see [Migrating from Akash Console](./migrating-from-akash-console.md)).

### Why bother running your own node

The same reasons you'd run your own node anywhere else:

- You trust your own infrastructure more than a third-party RPC
- You want the UI's chain queries to match exactly what your indexer or backend sees
- You're a provider or validator already running a node — might as well point your tooling at it

## Manage your deployment certificates

Akash uses x509 certificates to authenticate deployment-shell sessions and log access. Each certificate is issued on-chain by your wallet and is tied to it. The cert/key pair lives in your browser; the public cert is registered on-chain.

### Create a certificate

The first time you try to open a shell or stream logs, Console Air will prompt you to create a certificate if you don't have one. Approve the on-chain transaction; the cert is generated, stored locally, and registered on-chain. From then on, shell and log access for that deployment uses that cert silently.

### View your certificates

**App Settings** → **Certificates** lists every cert tied to your current address:

- **Selected** — the one Console Air will use for new shell/log sessions
- **Local cert** — whether the private key is in your local browser (you can use it) or only the public cert is on-chain (you can't)
- **Issued on / Expires** — cert lifecycle dates
- **Serial** — on-chain cert identifier

### Revoke a certificate

Click **Revoke** next to any cert to broadcast a revoke transaction. The cert becomes invalid for new sessions immediately. **Revoke All** revokes every cert tied to the current address.

You'd revoke a cert if:

- You think the private key was leaked
- You exported your local data to a machine you no longer control
- You just want to start clean

After revoking, you'll need to issue a new cert before opening shells or streaming logs again.

### Back up your certificates

Use **App Settings** → **General** → **Export Local Data**. The export includes every cert/key pair currently in your browser. Keep the file somewhere safe — see the warning in [Migrating from Akash Console](./migrating-from-akash-console.md).

If you lose your local data and don't have an export, the on-chain public cert is still there but the private key isn't. You can't use it any more — revoke it and issue a new cert.

## What's not in Console Air

Console Air exists specifically to be the self-custody Console. The following are intentionally **not** here:

- Managed wallets (sign with email / social login)
- Credit-card billing
- Trial allowances
- Anything that requires Console Air to hold key material on your behalf

If you want any of those, use [Akash Console](https://console.akash.network) instead. Both consoles point at the same network — pick the one whose trade-offs match what you're doing.

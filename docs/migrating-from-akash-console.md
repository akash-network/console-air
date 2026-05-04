# Migrating from Akash Console to Console Air

Console Air and Akash Console are the same codebase, with the managed-wallet flows removed from Console Air. That means the local data formats — saved deployments, certificates, network preferences, favorites — are identical, and migrating is a straight one-to-one transfer.

You don't need to redeploy anything. Your deployments live on-chain; this migration is only about moving local UI state (certs, favorites, settings) so Console Air picks up where you left off.

## What's stored locally

Most of what you see in the console is fetched live from the chain and from providers. A few things are stored in your browser's `localStorage`:

- **Wallet metadata** — the addresses you've connected, mnemonic-encrypted-with-password if you set one, the currently selected wallet
- **Deployment certificates** — the cert/key pairs you've generated for accessing deployment shells and logs
- **Settings** — custom RPC/API URLs, theme, selected network
- **Favorites** — bookmarked SDLs, templates, providers

These don't sync across browsers or devices, so if you've been using Akash Console in browser A, you'll need to bring that local state to Console Air running in browser A (or wherever you migrate to).

## Step 1: Export from Akash Console

1. Open [console.akash.network](https://console.akash.network) and sign in with the same wallet you've been using
2. Click your avatar → **App Settings**
3. Under **General**, click **Export Local Data**
4. A JSON file downloads — keep it somewhere safe

The export is a single JSON file containing every namespaced key Console writes to localStorage. It includes your encrypted wallets, your certificates, and your settings. It does **not** include your unencrypted private keys — those still live in Keplr / your hardware wallet.

> **Treat the export file like sensitive data.** It contains certificate private keys and (if you used a self-custody wallet protected by a password) the encrypted mnemonic blob. Anyone with the file plus your password could restore your wallet. Don't post it in a Slack channel; don't email it to yourself in plaintext.

## Step 2: Import into Console Air

1. Open Console Air (locally or wherever you're hosting it)
2. Connect the same wallet (Keplr will prompt you)
3. Click your avatar → **App Settings**
4. Under **General**, click **Import Local Data**
5. Select the JSON file you exported

You'll see your certificates listed under **Certificates** with the same serials, your custom node settings restored, and your favorites back. Your deployments load from chain — no extra step needed.

## What's not in the export

- **Managed-wallet billing data** (credit cards, balances, trial state) — Console Air doesn't have managed wallets, so this is intentionally not migrated. If you used managed wallets on Akash Console, you'll need to fund a self-custody wallet directly with ACT to use Console Air.
- **Email / social login session** — Console Air doesn't have email login. You sign in with your Keplr wallet directly.
- **Browser cookies** — auth cookies are scoped per-domain and don't migrate. You'll re-auth on first load.

## Verifying the migration worked

Quick sanity check after importing:

1. **App Settings → Certificates** — your existing certs should be listed
2. **Deployments** — your active deployments should appear, scoped to the wallet you connected
3. **App Settings → Network** — your custom node settings (if any) should be preserved

If something doesn't look right, the export file is the source of truth. You can open it as JSON and inspect what was actually exported. File an issue if the import skipped something it shouldn't have.

## Rolling back

If you want to go back to Akash Console for any reason, the same flow works in reverse:

1. **Export Local Data** from Console Air
2. **Import Local Data** on Akash Console (only the keys Akash Console understands will be restored — managed-wallet keys it might add aren't in your export, but your certs and favorites carry back fine)

There's no penalty for trying both.

# Console Air Documentation

Console Air is the self-hosted, self-custodial sibling of [Akash Console](https://console.akash.network). It's the same UI you've been using on `console.akash.network`, with the self-custody features kept and the managed-wallet flows removed.

This is the right tool for you if any of the following are true:

- You hold ACT and want to sign your own transactions with your own Keplr wallet
- You want to run the console against your own RPC and API endpoints
- You want to self-host the entire deploy UI behind your own domain
- You want full ownership of your deployment certificates and local data
- You're a provider, validator, or builder who lives in the Cosmos ecosystem already

If none of those apply — if you just want the fastest path from "I have a Docker image" to "it's running" — you probably want [Akash Console](https://console.akash.network), not Console Air.

## Where to start

| If you want to... | Read |
|---|---|
| Run Console Air locally or self-host it | [Self-hosting guide](./self-hosting.md) |
| Move from console.akash.network to Console Air | [Migrating from Akash Console](./migrating-from-akash-console.md) |
| Connect Keplr, configure a custom RPC, manage certs | [Self-custody guide](./self-custody.md) |

## Why does Console Air exist?

Akash Console at `console.akash.network` is going through a focused product split. The managed-wallet flow (email/social login + credit-card billing) is staying there. The self-custody flow (Keplr, signing your own transactions, custom RPC, custom certificates) is moving here.

Both consoles point at the same Akash Network — the same providers, the same chain, the same deployments. You can use either. Console Air gives you the full self-custodial experience without the managed-wallet UX trade-offs.

The full rationale lives in [AEP-84: Console Split](https://github.com/akash-network/AEP/tree/main/spec/aep-84) and the [announcement blog post](https://akash.network/blog/introducing-console-air-self-host-self-custody).

## Getting help

- File issues on this repo
- Find the team in the [Akash Discord](https://discord.gg/akash)

import type { MainWalletBase } from "@cosmos-kit/core";

export const COSMOS_KIT_CURRENT_WALLET_KEY = "cosmos-kit@2:core//current-wallet";
export const COSMOS_KIT_ACCOUNTS_KEY = "cosmos-kit@2:core//accounts";

export function hasPersistedCosmosKitWallet(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.localStorage.getItem(COSMOS_KIT_CURRENT_WALLET_KEY);
}

// Cosmos-kit auto-restores the persisted wallet on ChainProvider mount. For
// WalletConnect-mode wallets that never finished pairing (refresh mid-QR) or
// that can't pair at all (no project ID configured), the restore leaves the
// wallet stuck in Connecting state. Run this before ChainProvider mounts to
// drop the persisted entry so cosmos-kit boots from a clean slate.
export function pruneStalePersistedWallet(wallets: MainWalletBase[], walletConnectProjectId: string | undefined): void {
  if (typeof window === "undefined") return;

  const persistedName = window.localStorage.getItem(COSMOS_KIT_CURRENT_WALLET_KEY);
  if (!persistedName) return;

  const wallet = wallets.find(w => w.walletName === persistedName);
  if (!wallet || wallet.walletInfo.mode !== "wallet-connect") return;

  const accountsRaw = window.localStorage.getItem(COSMOS_KIT_ACCOUNTS_KEY);
  const hasAccounts = !!accountsRaw && accountsRaw !== "[]";

  const reason = !walletConnectProjectId
    ? "no WalletConnect project ID configured"
    : !hasAccounts
      ? "abandoned pairing (no persisted accounts)"
      : null;

  if (!reason) return;

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[Console Air] Clearing stale cosmos-kit wallet "${persistedName}": ${reason}.`);
  }
  window.localStorage.removeItem(COSMOS_KIT_CURRENT_WALLET_KEY);
  window.localStorage.removeItem(COSMOS_KIT_ACCOUNTS_KEY);
}

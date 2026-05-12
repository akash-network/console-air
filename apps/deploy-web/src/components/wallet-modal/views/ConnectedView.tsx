"use client";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import type { ChainWalletBase } from "@cosmos-kit/core";
import { Check, Copy, LogOut } from "iconoir-react";

import { Header } from "./Header";
import { WalletLogo } from "./WalletLogo";

function truncate(address: string, head = 9, tail = 6) {
  if (!address || address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function ConnectedView({ wallet, onClose, onReturn }: { wallet: ChainWalletBase; onClose: () => void; onReturn: () => void }) {
  const { prettyName, logo } = wallet.walletInfo;
  const address = wallet.address;
  const username = wallet.username;
  const major = typeof logo === "object" ? logo?.major : logo;
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onDisconnect = async () => {
    await wallet.disconnect();
    onClose();
  };

  return {
    head: <Header title="Wallet connected" onClose={onClose} onReturn={onReturn} />,
    content: (
      <div className="flex flex-col gap-4">
        <div className="bg-secondary flex items-center gap-3 rounded-md border border-border p-3">
          <WalletLogo src={major} alt={prettyName} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-foreground truncate text-sm font-medium">{username || prettyName}</div>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span className="font-mono">{address ? truncate(address) : "—"}</span>
              {address && (
                <button
                  type="button"
                  onClick={onCopy}
                  aria-label="Copy address"
                  className="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex h-5 w-5 items-center justify-center rounded transition-colors"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <Button variant="outline" onClick={onDisconnect} className="w-full" data-testid="disconnect-wallet-btn">
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </Button>
      </div>
    )
  };
}
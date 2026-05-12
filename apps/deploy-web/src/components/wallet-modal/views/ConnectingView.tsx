"use client";
import { Spinner } from "@akashnetwork/ui/components";
import type { ChainWalletBase } from "@cosmos-kit/core";

import { Header } from "./Header";
import { WalletLogo } from "./WalletLogo";

export function ConnectingView({ wallet, onClose, onReturn }: { wallet: ChainWalletBase; onClose: () => void; onReturn: () => void }) {
  const { prettyName, logo, mode } = wallet.walletInfo;
  const major = typeof logo === "object" ? logo?.major : logo;

  const subtitle =
    mode === "wallet-connect"
      ? `Approve the ${prettyName} connection request on your mobile device.`
      : `Open the ${prettyName} browser extension to approve the connection.`;

  return {
    head: <Header title={prettyName} onClose={onClose} onReturn={onReturn} />,
    content: (
      <div className="flex flex-col items-center gap-4 py-4">
        <WalletLogo src={major} alt={prettyName} size="xl" />
        <div className="text-center">
          <div className="text-foreground flex items-center justify-center gap-2 text-sm font-medium">
            <Spinner size="small" />
            Requesting connection
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
        </div>
      </div>
    )
  };
}
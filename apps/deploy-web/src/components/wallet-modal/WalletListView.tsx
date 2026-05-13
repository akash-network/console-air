"use client";
import { useCallback, useMemo } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import type { ChainWalletBase } from "@cosmos-kit/core";
import { NavArrowRight } from "iconoir-react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { Header } from "./views/Header";
import { WalletLogo } from "./views/WalletLogo";

const isWalletConnectEnabled = Boolean(browserEnvConfig.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID);

type WalletViewModel = {
  name: string;
  prettyName: string;
  logo?: string;
  isMobile: boolean;
  originalWallet: ChainWalletBase;
};

function toViewModel(wallet: ChainWalletBase): WalletViewModel {
  const { name, prettyName, logo, mode } = wallet.walletInfo;
  return {
    name,
    prettyName,
    logo: typeof logo === "object" ? logo?.major : logo,
    isMobile: mode === "wallet-connect",
    originalWallet: wallet
  };
}

function WalletItem({ wallet, onClick, disabled }: { wallet: WalletViewModel; onClick: () => void; disabled?: boolean }) {
  const button = (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      data-testid={`wallet-item-${wallet.name}`}
      className="bg-secondary hover:bg-muted flex w-full items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-secondary"
    >
      <WalletLogo src={wallet.logo} alt={wallet.prettyName} size="md" />
      <div className="min-w-0 flex-1">
        <div className="text-foreground truncate text-sm font-medium">{wallet.prettyName}</div>
        <div className="text-muted-foreground text-xs">{wallet.isMobile ? "WalletConnect" : "Browser extension"}</div>
      </div>
      <NavArrowRight className="text-muted-foreground h-4 w-4" />
    </button>
  );

  if (!disabled) {
    return button;
  }

  return (
    <CustomTooltip
      title={
        <>
          Mobile wallet support requires a WalletConnect project ID. See the{" "}
          <a
            href="https://github.com/akash-network/console-air/blob/main/docs/self-hosting.md#mobile-wallet-support-optional"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            self-hosting docs
          </a>
          .
        </>
      }
    >
      <div className="w-full">{button}</div>
    </CustomTooltip>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground mb-2 px-1 text-xs font-medium">{children}</div>;
}

function DynamicWalletList({ wallets, onClose, onWalletSelected }: { wallets: ChainWalletBase[]; onClose: () => void; onWalletSelected: (wallet: ChainWalletBase) => void }) {
  const onWalletClicked = useCallback(
    async (wallet: ChainWalletBase) => {
      onWalletSelected(wallet);
      try {
        await wallet.connect(wallet.walletStatus !== "NotExist");
      } catch {
        // wallet.walletStatus will reflect Error and the modal stays open to show StatusView
      }
      if (wallet.walletStatus === "Connected") {
        onClose();
      }
    },
    [onClose, onWalletSelected]
  );

  const { extensions, mobile } = useMemo(() => {
    const list = wallets.map(toViewModel);
    return {
      extensions: list.filter(w => !w.isMobile),
      mobile: list.filter(w => w.isMobile)
    };
  }, [wallets]);

  return (
    <div className="flex flex-col gap-4">
      {extensions.length > 0 && (
        <section>
          <SectionLabel>Browser extensions</SectionLabel>
          <div className="flex flex-col gap-2">
            {extensions.map(w => (
              <WalletItem key={w.name} wallet={w} onClick={() => onWalletClicked(w.originalWallet)} />
            ))}
          </div>
        </section>
      )}

      {mobile.length > 0 && (
        <section>
          <SectionLabel>Mobile</SectionLabel>
          <div className="flex flex-col gap-2">
            {mobile.map(w => (
              <WalletItem
                key={w.name}
                wallet={w}
                onClick={() => onWalletClicked(w.originalWallet)}
                disabled={!isWalletConnectEnabled}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function WalletListView({ onClose, wallets, onWalletSelected }: { onClose: () => void; wallets: ChainWalletBase[]; onWalletSelected: (wallet: ChainWalletBase) => void }) {
  return {
    head: <Header title="Select your wallet" onClose={onClose} />,
    content: <DynamicWalletList wallets={wallets} onClose={onClose} onWalletSelected={onWalletSelected} />
  };
}
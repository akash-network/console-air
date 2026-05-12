"use client";
import { Button } from "@akashnetwork/ui/components";
import type { ChainWalletBase } from "@cosmos-kit/core";
import { Download, Refresh } from "iconoir-react";

import { Header } from "./Header";
import { WalletLogo } from "./WalletLogo";

type Variant = "error" | "rejected" | "not-exist";

const COPY: Record<Variant, { title: string; subtitle: (name: string) => string }> = {
  error: {
    title: "Something went wrong",
    subtitle: name => `We couldn't reach ${name}. You can try reconnecting from here.`
  },
  rejected: {
    title: "Connection rejected",
    subtitle: name => `${name} rejected the connection request. Try again to approve it.`
  },
  "not-exist": {
    title: "Wallet not installed",
    subtitle: name => `Install the ${name} extension, then come back and reconnect.`
  }
};

export function StatusView({
  wallet,
  variant,
  onClose,
  onReturn
}: {
  wallet: ChainWalletBase;
  variant: Variant;
  onClose: () => void;
  onReturn: () => void;
}) {
  const { prettyName, logo, downloads } = wallet.walletInfo;
  const major = typeof logo === "object" ? logo?.major : logo;
  const copy = COPY[variant];
  const detail = variant !== "not-exist" ? wallet.message : undefined;

  const action =
    variant === "not-exist"
      ? {
          icon: <Download className="mr-2 h-4 w-4" />,
          label: `Install ${prettyName}`,
          onClick: () => {
            const url = downloads?.[0]?.link;
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          }
        }
      : {
          icon: <Refresh className="mr-2 h-4 w-4" />,
          label: "Try again",
          onClick: () => wallet.connect(true)
        };

  return {
    head: <Header title={copy.title} onClose={onClose} onReturn={onReturn} />,
    content: (
      <div className="flex flex-col items-center gap-4 py-4">
        <WalletLogo src={major} alt={prettyName} size="xl" />
        <div className="text-center">
          <p className="text-foreground text-sm font-medium">{prettyName}</p>
          <p className="text-muted-foreground mt-1 max-w-xs text-xs">{copy.subtitle(prettyName)}</p>
          {detail && <p className="text-destructive mt-2 max-w-xs break-words rounded bg-secondary px-3 py-2 text-left font-mono text-[11px]">{detail}</p>}
        </div>
        <Button variant="default" onClick={action.onClick} className="w-full">
          {action.icon}
          {action.label}
        </Button>
      </div>
    )
  };
}
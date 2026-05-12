"use client";
import { Spinner } from "@akashnetwork/ui/components";
import type { ChainWalletBase } from "@cosmos-kit/core";
import { State } from "@cosmos-kit/core";
import { useQRCode } from "next-qrcode";

import { Header } from "./Header";
import { WalletLogo } from "./WalletLogo";

function QRImage({ data }: { data: string }) {
  const { Canvas } = useQRCode();
  return (
    <Canvas
      text={data}
      options={{
        margin: 2,
        scale: 6,
        width: 240,
        color: { dark: "#000000", light: "#FFFFFF" }
      }}
    />
  );
}

export function QRCodeView({ wallet, onClose, onReturn }: { wallet: ChainWalletBase; onClose: () => void; onReturn: () => void }) {
  const { prettyName, logo } = wallet.walletInfo;
  const major = typeof logo === "object" ? logo?.major : logo;
  const qrUrl = wallet.qrUrl;
  const data = qrUrl?.data;
  const isReady = qrUrl?.state === State.Done && !!data;
  const isError = qrUrl?.state === State.Error;
  const errorMessage = qrUrl?.message || wallet.message;

  return {
    head: <Header title={`Scan with ${prettyName}`} onClose={onClose} onReturn={onReturn} />,
    content: (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="bg-secondary relative flex items-center justify-center rounded-md border border-border p-3">
          {isReady ? (
            <div className="overflow-hidden rounded bg-white p-2">
              <QRImage data={data!} />
            </div>
          ) : isError ? (
            <div className="text-muted-foreground flex h-[240px] w-[240px] items-center justify-center text-center text-xs">{errorMessage || "QR code failed to load"}</div>
          ) : (
            <div className="flex h-[240px] w-[240px] items-center justify-center">
              <Spinner size="medium" />
            </div>
          )}
          {isReady && (
            <div className="bg-card absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-border">
              <WalletLogo src={major} alt={prettyName} size="sm" className="rounded-md" />
            </div>
          )}
        </div>
      </div>
    )
  };
}
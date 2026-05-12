"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@akashnetwork/ui/components";
import type { ChainWalletBase, ModalOptions, WalletModalProps } from "@cosmos-kit/core";
import { ModalView, State, WalletStatus } from "@cosmos-kit/core";

import { ConnectedView } from "./views/ConnectedView";
import { ConnectingView } from "./views/ConnectingView";
import { QRCodeView } from "./views/QRCodeView";
import { StatusView } from "./views/StatusView";
import { WalletListView } from "./WalletListView";

type WalletModalComponentProps = WalletModalProps & {
  modalOptions?: ModalOptions;
};

export function WalletModal({ isOpen, setOpen, walletRepo, modalOptions }: WalletModalComponentProps) {
  const [currentView, setCurrentView] = useState(ModalView.WalletList);
  const [qrState, setQRState] = useState(State.Init);
  const [qrMsg, setQRMsg] = useState("");
  const [selectedWallet, setSelectedWallet] = useState<ChainWalletBase | undefined>();

  const disconnectOptions = {
    walletconnect: {
      removeAllPairings: modalOptions?.mobile?.displayQRCodeEveryTime
    }
  };

  walletRepo?.setCallbackOptions({
    beforeConnect: { disconnect: disconnectOptions }
  });

  const current: ChainWalletBase | undefined = walletRepo?.current ?? selectedWallet;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (current?.client as any)?.setActions?.({
    qrUrl: {
      state: setQRState,
      message: setQRMsg
    }
  });

  const walletStatus = current?.walletStatus;
  const message = current?.message;

  useEffect(() => {
    if (!isOpen) return;
    switch (walletStatus) {
      case WalletStatus.Connecting:
        setCurrentView(qrState === State.Init ? ModalView.Connecting : ModalView.QRCode);
        break;
      case WalletStatus.Connected:
        setCurrentView(ModalView.Connected);
        break;
      case WalletStatus.Error:
        setCurrentView(qrState === State.Init ? ModalView.Error : ModalView.QRCode);
        break;
      case WalletStatus.Rejected:
        setCurrentView(ModalView.Rejected);
        break;
      case WalletStatus.NotExist:
        setCurrentView(prev => (prev === ModalView.Connected ? ModalView.WalletList : ModalView.NotExist));
        break;
      case WalletStatus.Disconnected:
        setCurrentView(ModalView.WalletList);
        break;
      default:
        setCurrentView(ModalView.WalletList);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrState, walletStatus, qrMsg, message]);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentView(walletStatus === WalletStatus.Connected ? ModalView.Connected : ModalView.WalletList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setQRState(State.Init);
    setQRMsg("");
  }, [isOpen]);

  const onCloseModal = useCallback(() => {
    if (current?.walletStatus === WalletStatus.Connecting) {
      current.disconnect(false, disconnectOptions);
    }
    setSelectedWallet(undefined);
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOpen, current]);

  const onReturn = useCallback(() => {
    setCurrentView(ModalView.WalletList);
  }, []);

  const wallets = walletRepo?.platformEnabledWallets;

  const view = useMemo(() => {
    if (currentView === ModalView.WalletList) {
      return WalletListView({
        onClose: onCloseModal,
        wallets: wallets || [],
        onWalletSelected: setSelectedWallet
      });
    }
    if (!current) return { head: null, content: null };

    switch (currentView) {
      case ModalView.Connecting:
        return ConnectingView({ wallet: current, onClose: onCloseModal, onReturn });
      case ModalView.Connected:
        return ConnectedView({ wallet: current, onClose: onCloseModal, onReturn });
      case ModalView.QRCode:
        return QRCodeView({ wallet: current, onClose: onCloseModal, onReturn });
      case ModalView.Error:
        return StatusView({ wallet: current, variant: "error", onClose: onCloseModal, onReturn });
      case ModalView.Rejected:
        return StatusView({ wallet: current, variant: "rejected", onClose: onCloseModal, onReturn });
      case ModalView.NotExist:
        return StatusView({ wallet: current, variant: "not-exist", onClose: onCloseModal, onReturn });
      default:
        return { head: null, content: null };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, onCloseModal, onReturn, current, wallets, qrState, qrMsg, message, modalOptions]);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onCloseModal()}>
      <DialogContent data-testid="wallet-modal" hideCloseButton className="bg-card max-w-[420px] gap-4 p-5">
        {view.head}
        <div>{view.content}</div>
      </DialogContent>
    </Dialog>
  );
}
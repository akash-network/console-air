"use client";
import "@interchain-ui/react/styles";
import "@interchain-ui/react/globalStyles";

import { useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { GasPrice } from "@cosmjs/stargate";
import type { ChainContext, WalletModalProps } from "@cosmos-kit/core";
import { wallets as metamask } from "@cosmos-kit/cosmos-extension-metamask";
import { wallets as cosmostation } from "@cosmos-kit/cosmostation-extension";
import { wallets as keplr } from "@cosmos-kit/keplr";
import { ChainProvider, useChain } from "@cosmos-kit/react";
import { useAtom } from "jotai";
import { useSnackbar } from "notistack";

import { assetLists, chains } from "@src/chains";
import { WalletModal } from "@src/components/wallet-modal/WalletModal";
import { browserEnvConfig } from "@src/config/browser-env.config";
import networkStore from "@src/store/networkStore";
import walletStore from "@src/store/walletStore";
import { registry } from "@src/utils/customRegistry";
import { COSMOS_KIT_CURRENT_WALLET_KEY, pruneStalePersistedWallet } from "./cosmosKitStorage";

const walletConnectProjectId = browserEnvConfig.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
const wallets = [...keplr, ...cosmostation, ...metamask];

pruneStalePersistedWallet(wallets, walletConnectProjectId);

if (!walletConnectProjectId && process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn(
    "[Console Air] NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set. " +
      "Mobile wallet (WalletConnect) support is disabled — browser extensions still work. " +
      "See docs/self-hosting.md to enable mobile wallets."
  );
}

type Props = {
  children: React.ReactNode;
};

export function CustomChainProvider({ children }: Props) {
  return (
    <ChainProvider
      chains={chains}
      assetLists={assetLists}
      wallets={wallets}
      walletModal={ModalWrapper}
      throwErrors={false}
      logLevel="WARN"
      sessionOptions={{
        duration: 31_556_926_000, // 1 year
        callback: () => {
          console.log("session expired");
          window.localStorage.removeItem(COSMOS_KIT_CURRENT_WALLET_KEY);
          window.location.reload();
        }
      }}
      {...(walletConnectProjectId
        ? {
            walletConnectOptions: {
              signClient: {
                projectId: walletConnectProjectId
              }
            }
          }
        : {})}
      endpointOptions={{
        isLazy: true,
        endpoints: {
          ...Object.fromEntries(chains.map(c => [c.chain_name, { rest: [], rpc: [] }]))
        }
      }}
      signerOptions={{
        preferredSignType: () => "direct",
        signingStargate: () =>
          ({
            registry,
            gasPrice: GasPrice.fromString("0.025uakt")
          }) as any
      }}
    >
      <WalletConnectErrorHandler />
      {children}
    </ChainProvider>
  );
}

/**
 * Watches wallet connection state and shows user-friendly messages for WalletConnect errors
 */
function WalletConnectErrorHandler() {
  const { enqueueSnackbar } = useSnackbar();
  const { chainRegistryName } = networkStore.useSelectedNetwork();
  const { message, isWalletError } = useChain(chainRegistryName);
  const lastShownErrorRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const isProposalExpired = isWalletError && message?.toLowerCase().includes("proposal expired");

    // Only show snackbar if this is a new error (not already shown)
    if (isProposalExpired && lastShownErrorRef.current !== message) {
      lastShownErrorRef.current = message;
      enqueueSnackbar(
        <Snackbar title="Wallet connection timed out" subTitle="The connection request expired. Please try connecting again." iconVariant="warning" />,
        { variant: "warning", autoHideDuration: 6000 }
      );
    }

    // Reset when error clears
    if (!isWalletError) {
      lastShownErrorRef.current = undefined;
    }
  }, [isWalletError, message, enqueueSnackbar]);

  return null;
}

export type { ChainContext };
export function useSelectedChain(): ChainContext {
  const { chainRegistryName } = networkStore.useSelectedNetwork();
  return useChain(chainRegistryName);
}

const ModalWrapper = (props: WalletModalProps) => {
  const { isWalletConnected } = useSelectedChain();
  const [isWalletModalOpen, setIsWalletModalOpen] = useAtom(walletStore.isWalletModalOpen);
  useEffect(() => {
    setIsWalletModalOpen(props.isOpen);
  }, [isWalletModalOpen, props.isOpen, isWalletConnected]);

  return <WalletModal isOpen={props.isOpen} setOpen={props.setOpen} walletRepo={props.walletRepo} />;
};

import { polkadot } from "@luno-kit/react/chains";
import {
  polkadotjsConnector,
  subwalletConnector,
  talismanConnector,
  polkagateConnector,
  novaConnector,
  walletConnectConnector,
  enkryptConnector,
  fearlessConnector,
  mimirConnector,
  onekeyConnector,
  ledgerConnector,
} from "@luno-kit/react/connectors";

export const chains = [polkadot];
export const WALLET_CONNECT_ID = "e5f0efe345290300d7320b5fa67bb6a4";
export const SUBSCAN_API_KEY = "35a441cb8b6447e5a68fb64e8b57d1cd";

export const walletOptions = [
  {
    id: "polkadotjs",
    name: "Polkadot.js",
    type: "Extension",
    connector: "polkadotjsConnector",
    logo: "/wallets/polkadotjs.svg",
  },
  {
    id: "subwallet",
    name: "SubWallet",
    type: "Extension + Mobile",
    connector: "subwalletConnector",
    logo: "/wallets/subwallet.svg",
  },
  {
    id: "talisman",
    name: "Talisman",
    type: "Extension",
    connector: "talismanConnector",
    logo: "/wallets/talisman.svg",
  },
  {
    id: "polkagate",
    name: "PolkaGate",
    type: "Extension",
    connector: "polkagateConnector",
    logo: "/wallets/polkagate.svg",
  },
  {
    id: "enkrypt",
    name: "Enkrypt",
    type: "Extension",
    connector: "enkryptConnector",
    logo: "/wallets/enkrypt.svg",
  },
  {
    id: "fearless",
    name: "Fearless",
    type: "Mobile",
    connector: "fearlessConnector",
    logo: "/wallets/fearless.svg",
  },
  {
    id: "mimir",
    name: "Mimir",
    type: "Multisig",
    connector: "mimirConnector",
    logo: "/wallets/mimir.svg",
  },
  {
    id: "onekey",
    name: "OneKey",
    type: "Hardware",
    connector: "onekeyConnector",
    logo: "/wallets/onekey.svg",
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    type: "Protocol",
    connector: "walletConnectConnector",
    requiresProjectId: true,
    logo: "/wallets/walletconnect.svg",
  },
  {
    id: "nova",
    name: "Nova Wallet",
    type: "Mobile (QR)",
    connector: "novaConnector",
    requiresProjectId: true,
    logo: "/wallets/nova.svg",
  },
  {
    id: "ledger",
    name: "Ledger",
    type: "Hardware",
    connector: "ledgerConnector",
    requiresChains: true,
    logo: "/wallets/ledger.svg",
  },
];

const connectorFactories = {
  polkadotjsConnector: () => polkadotjsConnector(),
  subwalletConnector: () => subwalletConnector(),
  talismanConnector: () => talismanConnector(),
  polkagateConnector: () => polkagateConnector(),
  novaConnector: (options) => novaConnector({ projectId: options.projectId }),
  walletConnectConnector: (options) =>
    walletConnectConnector({ projectId: options.projectId }),
  enkryptConnector: () => enkryptConnector(),
  fearlessConnector: () => fearlessConnector(),
  mimirConnector: () => mimirConnector(),
  onekeyConnector: () => onekeyConnector(),
  ledgerConnector: (options) => ledgerConnector({ chains: options.chains }),
};

export const getSelectedWalletData = (selectedWalletIds) =>
  walletOptions.filter((wallet) => selectedWalletIds.includes(wallet.id));

export const buildConnectors = ({
  selectedWalletData,
  chains: chainsConfig = chains,
}) =>
  selectedWalletData.flatMap((wallet) => {
    const factory = connectorFactories[wallet.connector];
    if (!factory) return [];

    if (wallet.requiresProjectId) {
      return [factory({ projectId: WALLET_CONNECT_ID })];
    }

    if (wallet.requiresChains) {
      return [factory({ chains: chainsConfig })];
    }

    return [factory()];
  });

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectButton,
  LunoKitProvider,
  useConnectModal,
  useAccountModal,
  useLunoTheme,
} from "@luno-kit/ui";
import { ConnectionStatus, createConfig, useStatus } from "@luno-kit/react";
import {
  buildConnectors,
  chains as defaultChains,
  getSelectedWalletData,
  SUBSCAN_API_KEY,
  walletOptions,
} from "./lunokitConfig";

const queryClient = new QueryClient();
const previewStorage = {
  async getItem() {
    return null;
  },
  async setItem() {},
  async removeItem() {},
};

const viewModes = [
  { id: "modal", label: "Modal" },
  { id: "button", label: "Button" },
  { id: "code", label: "Code" },
];

const modalSizes = [
  { id: "wide", label: "Wide" },
  { id: "compact", label: "Compact" },
];

const themeModes = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
];

const fontOptions = [
  { id: "dm-sans", label: "DM Sans", value: "DM Sans, system-ui, sans-serif" },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    value: "Space Grotesk, system-ui, sans-serif",
  },
  { id: "manrope", label: "Manrope", value: "Manrope, system-ui, sans-serif" },
  { id: "sora", label: "Sora", value: "Sora, system-ui, sans-serif" },
  { id: "outfit", label: "Outfit", value: "Outfit, system-ui, sans-serif" },
];

const colorGroupConfig = [
  {
    id: "General",
    match: (key) =>
      ["accentColor", "separatorLine", "defaultIconBackground", "skeleton"].includes(
        key
      ),
  },
  { id: "Modal", match: (key) => key.startsWith("modal") },
  { id: "Wallet Select", match: (key) => key.startsWith("walletSelect") },
  { id: "Connect Button", match: (key) => key.startsWith("connectButton") },
  { id: "Account", match: (key) => key.startsWith("account") },
  {
    id: "Network",
    match: (key) => key.toLowerCase().includes("network"),
  },
  { id: "Assets", match: (key) => key.startsWith("asset") },
  { id: "Navigation", match: (key) => key.startsWith("navigation") },
  {
    id: "Status",
    match: (key) =>
      ["success", "warning", "error", "info"].some((prefix) =>
        key.startsWith(prefix)
      ),
  },
  { id: "Other", match: () => true },
];

const formatColorLabel = (token) =>
  token
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const controlBase =
  "h-10 w-full rounded-xl border border-white/10 bg-black/50 px-3 text-sm text-white placeholder:text-white/40 transition-colors focus:outline-none focus:ring-2 focus:ring-white/15 hover:border-white/20 hover:bg-black/60";
const controlSmall =
  "h-9 w-full rounded-xl border border-white/10 bg-black/60 px-3 text-xs text-white placeholder:text-white/40 transition-colors focus:outline-none focus:ring-2 focus:ring-white/15 hover:border-white/20 hover:bg-black/70";

const groupColorKeys = (keys) => {
  const groups = new Map();
  keys.forEach((key) => {
    const group =
      colorGroupConfig.find((config) => config.match(key))?.id || "Other";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(key);
  });
  return colorGroupConfig
    .map((config) => ({
      id: config.id,
      keys: groups.get(config.id) || [],
    }))
    .filter((group) => group.keys.length > 0);
};

const readLunoKitThemeTokens = () => {
  if (typeof window === "undefined") return null;
  const styles = getComputedStyle(document.documentElement);
  const tokens = {
    colors: {},
    fonts: {},
    radii: {},
    shadows: {},
    blurs: {},
  };
  for (let i = 0; i < styles.length; i += 1) {
    const name = styles[i];
    if (!name || !name.startsWith("--")) continue;
    const value = styles.getPropertyValue(name).trim();
    if (!value) continue;
    if (name.startsWith("--color-")) {
      tokens.colors[name.slice(8)] = value;
      continue;
    }
    if (name.startsWith("--font-")) {
      tokens.fonts[name.slice(7)] = value;
      continue;
    }
    if (name.startsWith("--radius-")) {
      tokens.radii[name.slice(9)] = value;
      continue;
    }
    if (name.startsWith("--shadow-")) {
      tokens.shadows[name.slice(9)] = value;
      continue;
    }
    if (name.startsWith("--blur-")) {
      tokens.blurs[name.slice(7)] = value;
    }
  }
  return tokens;
};

export default function App() {
  const [viewMode, setViewMode] = useState("modal");
  const [openSection, setOpenSection] = useState("wallets");
  const [selectedWallets, setSelectedWallets] = useState(() => [
    "polkadotjs",
    "subwallet",
    "talisman",
  ]);
  const [modalSize, setModalSize] = useState("wide");
  const [appName, setAppName] = useState("LunoKit Demo");
  const [decorativeLight, setDecorativeLight] = useState("");
  const [decorativeDark, setDecorativeDark] = useState("");
  const [appDescription, setAppDescription] = useState(
    "Wallet sign-in configuration playground"
  );
  const [guideText, setGuideText] = useState("Integration guide");
  const [guideLink, setGuideLink] = useState("https://docs.lunolab.xyz/");
  const [termsUrl, setTermsUrl] = useState("https://lunolab.xyz/terms");
  const [privacyUrl, setPrivacyUrl] = useState("https://lunolab.xyz/privacy");
  const [themeMode, setThemeMode] = useState("dark");
  const [baseThemes, setBaseThemes] = useState({ dark: null, light: null });
  const [colorTokenKeys, setColorTokenKeys] = useState([]);
  const [colorOverrides, setColorOverrides] = useState({ dark: {}, light: {} });
  const [fontOverrides, setFontOverrides] = useState({ dark: "", light: "" });
  const [radiusOverrides, setRadiusOverrides] = useState({
    dark: "",
    light: "",
  });
  const [colorSearch, setColorSearch] = useState("");
  const [buttonLabel, setButtonLabel] = useState("Connect Wallet");
  const [copied, setCopied] = useState(false);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const copyTimeoutRef = useRef(null);
  const [modalPortalContainer, setModalPortalContainer] = useState(null);
  const modalContainerRef = useCallback((node) => {
    if (!node) {
      setModalPortalContainer(null);
      return;
    }
    setModalPortalContainer(node);
  }, []);

  useEffect(() => {
    setIsPreviewReady(true);
  }, []);

  useEffect(() => {
    if (!isPreviewReady) return undefined;
    let cancelled = false;
    const scheduleRead = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          const tokens = readLunoKitThemeTokens();
          if (!tokens || Object.keys(tokens.colors).length === 0) return;
          setBaseThemes((prev) => {
            const existing = prev[themeMode];
            if (existing && Object.keys(existing.colors || {}).length > 0) {
              return prev;
            }
            return { ...prev, [themeMode]: tokens };
          });
          setColorTokenKeys((prev) => {
            if (prev.length > 0) return prev;
            return Object.keys(tokens.colors).sort((a, b) => a.localeCompare(b));
          });
        });
      });
    };
    scheduleRead();
    const link = document.getElementById("lunokit-styles");
    link?.addEventListener("load", scheduleRead, { once: true });
    return () => {
      cancelled = true;
      link?.removeEventListener("load", scheduleRead);
    };
  }, [themeMode, isPreviewReady]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const selectedWalletData = useMemo(
    () => getSelectedWalletData(selectedWallets),
    [selectedWallets]
  );

  const chains = defaultChains;

  const connectors = useMemo(
    () =>
      buildConnectors({
        selectedWalletData,
        chains,
      }),
    [selectedWalletData, chains]
  );

  const baseConfig = useMemo(() => {
    if (!connectors.length) return null;
    return createConfig({
      appName: appName || "LunoKit Demo",
      chains,
      connectors,
      autoConnect: false,
      storage: previewStorage,
      subscan: {
        apiKey: SUBSCAN_API_KEY,
      },
    });
  }, [appName, chains, connectors]);

  const resolvedModalSize = useMemo(
    () => (modalSize === "wide" ? "wide" : "compact"),
    [modalSize]
  );

  const config = useMemo(() => {
    if (!baseConfig) return null;
    const nextConfig = {
      ...baseConfig,
      modalSize: resolvedModalSize,
    };
    if (viewMode === "modal" && modalPortalContainer) {
      nextConfig.modalContainer = modalPortalContainer;
    }
    return nextConfig;
  }, [baseConfig, resolvedModalSize, viewMode, modalPortalContainer]);

  useEffect(() => {
    if (!modalPortalContainer) return undefined;
    const root = modalPortalContainer;
    const applyOverrides = () => {
      const overlay = root.querySelector(".luno\\:fixed.luno\\:inset-0");
      if (overlay) {
        overlay.style.setProperty("position", "absolute", "important");
        overlay.style.setProperty("inset", "0", "important");
        overlay.style.setProperty("width", "100%", "important");
        overlay.style.setProperty("height", "100%", "important");
        overlay.style.setProperty("display", "none", "important");
      }
      const dialogs = root.querySelectorAll(
        "[role=\"dialog\"].luno\\:fixed"
      );
      dialogs.forEach((dialog) => {
        dialog.style.setProperty("position", "absolute", "important");
        dialog.style.setProperty("max-width", "100%", "important");
        dialog.style.setProperty("max-height", "100%", "important");
      });
    };
    applyOverrides();
    const observer = new MutationObserver(applyOverrides);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, [modalPortalContainer]);

  const baseTheme = baseThemes[themeMode] || {
    colors: {},
    fonts: {},
    radii: {},
    shadows: {},
    blurs: {},
  };
  const baseColors = baseTheme.colors || {};
  const baseFonts = baseTheme.fonts || {};
  const baseRadii = baseTheme.radii || {};
  const currentColorOverrides = colorOverrides[themeMode] || {};
  const currentFontOverride = fontOverrides[themeMode] || "";
  const currentRadiusOverride = radiusOverrides[themeMode] ?? "";
  const radiusKeys = useMemo(() => {
    const darkKeys = Object.keys(baseThemes.dark?.radii || {});
    if (darkKeys.length > 0) return darkKeys;
    const lightKeys = Object.keys(baseThemes.light?.radii || {});
    if (lightKeys.length > 0) return lightKeys;
    return Object.keys(baseRadii || {});
  }, [baseThemes, baseRadii]);
  const resolvedColors = useMemo(
    () => ({ ...baseColors, ...currentColorOverrides }),
    [baseColors, currentColorOverrides]
  );
  const resolvedBodyFont =
    currentFontOverride || baseFonts.body || fontOptions[0].value;
  const resolvedFontOptions = useMemo(() => {
    if (!baseFonts.body) return fontOptions;
    if (fontOptions.some((option) => option.value === baseFonts.body)) {
      return fontOptions;
    }
    return [
      { id: "luno-default", label: "Default", value: baseFonts.body },
      ...fontOptions,
    ];
  }, [baseFonts.body]);
  const radiusOverrideTokens = useMemo(() => {
    if (currentRadiusOverride === "") return null;
    if (radiusKeys.length === 0) return null;
    const token = currentRadiusOverride.endsWith("px")
      ? currentRadiusOverride
      : `${currentRadiusOverride}px`;
    return radiusKeys.reduce((acc, key) => {
      acc[key] = token;
      return acc;
    }, {});
  }, [currentRadiusOverride, radiusKeys]);
  const radiusOverridesByMode = useMemo(() => {
    if (radiusKeys.length === 0) return {};
    return themeModes.reduce((acc, mode) => {
      const raw = radiusOverrides[mode.id] ?? "";
      if (raw === "") return acc;
      const token = raw.endsWith("px") ? raw : `${raw}px`;
      acc[mode.id] = radiusKeys.reduce((next, key) => {
        next[key] = token;
        return next;
      }, {});
      return acc;
    }, {});
  }, [radiusOverrides, radiusKeys]);
  const themeOverridesByMode = useMemo(() => {
    return themeModes.reduce((acc, mode) => {
      const colors = colorOverrides[mode.id] || {};
      const font = fontOverrides[mode.id] || "";
      const radii = radiusOverridesByMode[mode.id] || null;
      const next = {};
      if (Object.keys(colors).length) {
        next.colors = colors;
      }
      if (font) {
        next.fonts = { body: font };
      }
      if (radii) {
        next.radii = radii;
      }
      if (Object.keys(next).length) {
        acc[mode.id] = next;
      }
      return acc;
    }, {});
  }, [colorOverrides, fontOverrides, radiusOverridesByMode]);
  const colorKeys = useMemo(() => colorTokenKeys, [colorTokenKeys]);
  const filteredColorKeys = useMemo(() => {
    const query = colorSearch.trim().toLowerCase();
    if (!query) return colorKeys;
    return colorKeys.filter((key) => {
      const label = formatColorLabel(key).toLowerCase();
      return key.toLowerCase().includes(query) || label.includes(query);
    });
  }, [colorKeys, colorSearch]);
  const groupedColorKeys = useMemo(
    () => groupColorKeys(filteredColorKeys),
    [filteredColorKeys]
  );
  const theme = useMemo(() => {
    const mode = themeMode || "dark";
    const payload = {
      autoMode: false,
      defaultMode: mode,
    };
    if (themeOverridesByMode.dark) {
      payload.dark = themeOverridesByMode.dark;
    }
    if (themeOverridesByMode.light) {
      payload.light = themeOverridesByMode.light;
    }
    return payload;
  }, [themeMode, themeOverridesByMode]);

  const appInfo = useMemo(() => {
    const info = {};

    if (decorativeLight.trim()) {
      info.decorativeImage = {
        light: decorativeLight.trim(),
        ...(decorativeDark.trim() ? { dark: decorativeDark.trim() } : {}),
      };
    }

    if (appDescription.trim()) {
      info.description = appDescription.trim();
    }

    if (guideLink.trim()) {
      info.guideText = guideText.trim() || "Integration guide";
      info.guideLink = guideLink.trim();
    }

    if (termsUrl.trim() && privacyUrl.trim()) {
      info.policyLinks = {
        terms: termsUrl.trim(),
        privacy: privacyUrl.trim(),
        target: "_blank",
      };
    }

    return info;
  }, [
    decorativeLight,
    decorativeDark,
    appDescription,
    guideText,
    guideLink,
    termsUrl,
    privacyUrl,
  ]);

  const hasAppInfo = Object.keys(appInfo).length > 0;
  const documentationLink = "https://docs.lunolab.xyz/";

  const codeSnippet = useMemo(() => {
    const connectorImports = Array.from(
      new Set(selectedWalletData.map((wallet) => wallet.connector))
    );
    const connectorLines = selectedWalletData.map((wallet) => {
      if (wallet.requiresProjectId) {
        return `${wallet.connector}({ projectId: WALLET_CONNECT_ID })`;
      }
      if (wallet.requiresChains) {
        return `${wallet.connector}({ chains })`;
      }
      return `${wallet.connector}()`;
    });

    const themeOverridesForSnippet = {};
    if (Object.keys(currentColorOverrides).length) {
      themeOverridesForSnippet.colors = currentColorOverrides;
    }
    if (currentFontOverride) {
      themeOverridesForSnippet.fonts = { body: currentFontOverride };
    }
    if (radiusOverrideTokens) {
      themeOverridesForSnippet.radii = radiusOverrideTokens;
    }
    const hasThemeOverrides = Object.keys(themeOverridesForSnippet).length > 0;
    const includeTheme = hasThemeOverrides || themeMode !== "light";
    const themeBlock = hasThemeOverrides
      ? JSON.stringify(themeOverridesForSnippet, null, 2).replace(
          /\n/g,
          "\n  "
        )
      : "";

    const lines = [
      "import { ConnectButton, LunoKitProvider } from \"@luno-kit/ui\";",
      "import { createConfig } from \"@luno-kit/react\";",
      "import { polkadot } from \"@luno-kit/react/chains\";",
      connectorImports.length
        ? `import { ${connectorImports.join(", ")} } from \"@luno-kit/react/connectors\";`
        : "",
      "import { QueryClient, QueryClientProvider } from \"@tanstack/react-query\";",
      "import \"@luno-kit/ui/styles.css\";",
      "",
      "const WALLET_CONNECT_ID = \"YOUR_WALLET_CONNECT_ID\";",
      "const SUBSCAN_API_KEY = \"YOUR_SUBSCAN_API_KEY\";",
      "",
      "const queryClient = new QueryClient();",
      "const chains = [polkadot];",
      "const baseConfig = createConfig({",
      `  appName: ${JSON.stringify(appName || "My LunoKit App")},`,
      "  chains,",
      "  connectors: [",
      connectorLines.length
        ? connectorLines.map((line) => `    ${line},`).join("\n")
        : "    // Select at least one connector",
      "  ],",
      "  subscan: { apiKey: SUBSCAN_API_KEY },",
      "});",
      `const config = { ...baseConfig, modalSize: \"${modalSize}\" };`,
      "",
      includeTheme
        ? [
            "const theme = {",
            "  autoMode: false,",
            `  defaultMode: \"${themeMode}\",`,
            hasThemeOverrides ? `  ${themeMode}: ${themeBlock},` : "",
            "};",
          ].filter(Boolean).join("\n")
        : "",
    ].filter(Boolean);

    if (hasAppInfo) {
      const appInfoBlock = JSON.stringify(appInfo, null, 2);
      lines.push("", `const appInfo = ${appInfoBlock};`);
    }

    lines.push(
      "",
      "export default function App() {",
      "  return (",
      "    <QueryClientProvider client={queryClient}>",
      `      <LunoKitProvider config={config}${
        includeTheme ? " theme={theme}" : ""
      }${hasAppInfo ? " appInfo={appInfo}" : ""}>`,
      `        <ConnectButton label={${JSON.stringify(
        buttonLabel || "Connect Wallet"
      )}} />`,
      "      </LunoKitProvider>",
      "    </QueryClientProvider>",
      "  );",
      "}",
      ""
    );

    return lines.join("\n");
  }, [
    selectedWalletData,
    appName,
    modalSize,
    themeMode,
    currentColorOverrides,
    currentFontOverride,
    radiusOverrideTokens,
    hasAppInfo,
    appInfo,
    buttonLabel,
  ]);

  const handleWalletToggle = (walletId) => {
    setSelectedWallets((prev) =>
      prev.includes(walletId)
        ? prev.filter((id) => id !== walletId)
        : [...prev, walletId]
    );
  };

  const handleSectionToggle = (sectionId) => {
    setOpenSection((prev) => (prev === sectionId ? null : sectionId));
  };

  const handleCopy = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(codeSnippet);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      setCopied(false);
    }
  };

  const previewEnabled = Boolean(config);
  const updateColor = useCallback((token, nextValue) => {
    setColorOverrides((prev) => ({
      ...prev,
      [themeMode]: {
        ...prev[themeMode],
        [token]: nextValue,
      },
    }));
  }, [themeMode]);
  const showProvider = viewMode !== "code" && previewEnabled && isPreviewReady;
  const previewRootClassName = `relative h-[560px] w-full max-w-3xl overflow-hidden${
    viewMode === "button" && showProvider ? " flex items-center justify-center" : ""
  }`;
  const previewRootFullClassName = "relative h-full w-full overflow-hidden";
  const previewShellClassName =
    viewMode === "code"
      ? "relative flex h-[660px] min-w-0 flex-col"
      : "relative flex h-[660px] min-w-0 flex-col";
  const previewShellContent =
    viewMode === "code" ? (
      <div className="flex h-full w-full items-start justify-start">
        <CodePreview code={codeSnippet} onCopy={handleCopy} copied={copied} />
      </div>
    ) : (
      <>
        <div className="mt-4 flex flex-1 items-center justify-center">
          <section
            data-lunokit-preview
            id="lunokit-modal-root"
            ref={modalContainerRef}
            data-preview-mode={viewMode === "modal" ? "modal" : "default"}
            className={previewRootClassName}
          >
            {!previewEnabled && (
              <EmptyPreview message="Select at least one wallet to enable the preview." />
            )}

            {viewMode === "button" && showProvider && (
              <ConnectButton label={buttonLabel || "Connect Wallet"} />
            )}
          </section>
        </div>
      </>
    );

  return (
    <div className="relative min-h-screen overflow-hidden px-6 pb-16 pt-10 text-[15px] text-white/80">
      <PreviewInteractivityGuards enabled={showProvider} />
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute right-12 top-10 h-64 w-64 rounded-full bg-white/5 blur-3xl animate-float-soft" />

      <header className="mx-auto w-full max-w-7xl">
        <div className="flex items-center justify-end">
          <a
            href={documentationLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:bg-white/15"
          >
            Documentation
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7" />
              <path d="M9 7h8v8" />
            </svg>
          </a>
        </div>
        <div className="mt-6 space-y-2">
          <p className="font-heading text-xs uppercase tracking-[0.32em] text-white/60">
            LunoKit Demo
          </p>
          <h1 className="text-balance font-heading text-3xl font-semibold text-white sm:text-4xl">
            Wallet Sign-In Builder & Live Preview
          </h1>
          <p className="max-w-xl text-white/60">
            Configure wallets, modal behavior, and theming tokens. Preview LunoKit
            UI components and export integration-ready code.
          </p>
        </div>
      </header>

      <main className="mx-auto mt-8 grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="space-y-5">
          <Section
            id="wallets"
            title="Wallets"
            description="Select the wallets that should appear in the LunoKit modal."
            isOpen={openSection === "wallets"}
            onToggle={handleSectionToggle}
          >
            <div className="grid gap-2 sm:grid-cols-1 lg:grid-cols-2">
              {walletOptions.map((wallet) => {
                const isChecked = selectedWallets.includes(wallet.id);
                return (
                  <label
                    key={wallet.id}
                    htmlFor={`wallet-${wallet.id}`}
                    className={`group flex min-h-[60px] cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 transition-colors ${
                      isChecked
                        ? "border-white/60 bg-white/8"
                        : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/40"
                    }`}
                  >
                    <input
                      id={`wallet-${wallet.id}`}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleWalletToggle(wallet.id)}
                      className="peer sr-only"
                    />
                    <div className="flex h-10 w-10 items-center justify-center">
                      {wallet.logo ? (
                        <img
                          src={wallet.logo}
                          alt={`${wallet.name} logo`}
                          className="h-7 w-7 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="font-heading text-lg font-semibold text-white">
                          {wallet.name[0]}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {wallet.name}
                      </p>
                      <p className="truncate text-[11px] text-white/45">{wallet.type}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-black/40 transition-colors group-hover:border-white/50">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            isChecked ? "bg-white" : "bg-transparent"
                          }`}
                        />
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </Section>

          <Section
            id="modal-options"
            title="Modal Options"
            description="Control modal size and add app-specific metadata."
            isOpen={openSection === "modal-options"}
            onToggle={handleSectionToggle}
          >
            <div className="grid gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                  Modal size
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {modalSizes.map((size) => (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => setModalSize(size.id)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        modalSize === size.id
                          ? "bg-white text-black"
                          : "border border-white/20 text-white/70 hover:border-white/60"
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <LabelInput
                  id="app-description"
                  label="App description"
                  value={appDescription}
                  onChange={setAppDescription}
                  placeholder="Short product tagline"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <LabelInput
                  id="decorative-light"
                  label="Decorative image (light)"
                  value={decorativeLight}
                  onChange={setDecorativeLight}
                  placeholder="https://..."
                />
                <LabelInput
                  id="decorative-dark"
                  label="Decorative image (dark)"
                  value={decorativeDark}
                  onChange={setDecorativeDark}
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <LabelInput
                  id="guide-text"
                  label="Guide text"
                  value={guideText}
                  onChange={setGuideText}
                  placeholder="Integration guide"
                />
                <LabelInput
                  id="guide-link"
                  label="Guide link"
                  value={guideLink}
                  onChange={setGuideLink}
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <LabelInput
                  id="terms-url"
                  label="Terms of Service link"
                  value={termsUrl}
                  onChange={setTermsUrl}
                  placeholder="https://..."
                />
                <LabelInput
                  id="privacy-url"
                  label="Privacy Policy link"
                  value={privacyUrl}
                  onChange={setPrivacyUrl}
                  placeholder="https://..."
                />
              </div>
            </div>
          </Section>

          <Section
            id="appearance"
            title="Appearance"
            description="Apply LunoKit theme tokens (black & white)."
            isOpen={openSection === "appearance"}
            onToggle={handleSectionToggle}
          >
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center gap-3">
                {themeModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setThemeMode(mode.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      themeMode === mode.id
                        ? "bg-white text-black"
                        : "border border-white/20 text-white/70 hover:border-white/60"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-white/70">
                  <span className="text-xs uppercase tracking-[0.16em] text-white/50">
                    Body font
                  </span>
                  <FontSelect
                    value={resolvedBodyFont}
                    options={resolvedFontOptions}
                    onChange={(nextValue) => {
                      setFontOverrides((prev) => ({
                        ...prev,
                        [themeMode]:
                          nextValue === (baseFonts.body || "") ? "" : nextValue,
                      }));
                    }}
                  />
                </label>

                <label className="space-y-2 text-sm text-white/70">
                  <span className="text-xs uppercase tracking-[0.16em] text-white/50">
                    Global radius
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={currentRadiusOverride}
                      onChange={(event) =>
                        setRadiusOverrides((prev) => ({
                          ...prev,
                          [themeMode]: event.target.value,
                        }))
                      }
                      placeholder="12"
                      className={`${controlBase} pr-10`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
                      px
                    </span>
                  </div>
                </label>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40">
                <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
                  <div className="text-sm font-semibold text-white">Colors</div>
                  <div className="relative ml-auto flex-1 sm:max-w-[220px]">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <path d="M21 21L16.65 16.65" />
                      </svg>
                    </span>
                    <input
                      value={colorSearch}
                      onChange={(event) => setColorSearch(event.target.value)}
                      placeholder="Search"
                      className={`${controlBase} pl-9 pr-3 text-xs`}
                    />
                  </div>
                </div>
                <div className="max-h-[360px] overflow-y-auto px-4 py-4">
                  {colorTokenKeys.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-8 text-center text-sm text-white/50">
                      Loading theme tokens...
                    </div>
                  ) : groupedColorKeys.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-8 text-center text-sm text-white/50">
                      No matches found.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {groupedColorKeys.map((group) => (
                        <div key={group.id} className="space-y-2">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                            <span>{group.id}</span>
                          </div>
                          <div className="space-y-2">
                            {group.keys.map((key) => (
                              <ColorPickerRow
                                key={key}
                                token={key}
                                value={resolvedColors[key] || "#000000"}
                                onChange={updateColor}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="button-options"
            title="Button Options"
            description="Customize the ConnectButton label."
            isOpen={openSection === "button-options"}
            onToggle={handleSectionToggle}
          >
            <LabelInput
              id="button-label"
              label="Button label"
              value={buttonLabel}
              onChange={setButtonLabel}
              placeholder="Connect Wallet"
            />
          </Section>

        </section>

        <section
          id="lunokit-preview-shell"
          className="space-y-4 rounded-3xl border border-white/10 bg-preview p-6 shadow-lg shadow-black/40"
        >
          <div className="flex items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/60 p-1 shadow-[0_10px_28px_rgba(0,0,0,0.5)] backdrop-blur">
              {viewModes.map((mode) => {
                const isActive = viewMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setViewMode(mode.id)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? "bg-white text-black"
                        : "text-white/70 hover:bg-white/10"
                    }`}
                >
                  {mode.label}
                </button>
              );
            })}
            </div>
          </div>

          <div className={previewShellClassName}>
            {showProvider ? (
              <QueryClientProvider client={queryClient}>
                <LunoKitProvider
                  config={config}
                  theme={theme}
                  {...(hasAppInfo ? { appInfo } : {})}
                >
                  <ThemeModeSync mode={themeMode} />
                  <AutoSwitchModals enabled={viewMode === "modal"} />
                  <AutoOpenConnectModal enabled={viewMode === "modal"} />
                  {previewShellContent}
                </LunoKitProvider>
              </QueryClientProvider>
            ) : (
              previewShellContent
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function AutoOpenConnectModal({ enabled }) {
  const { open, close, isOpen } = useConnectModal();
  const hasOpenedRef = useRef(false);
  const autoOpenedRef = useRef(false);
  const openTimeoutRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (openTimeoutRef.current) {
        clearTimeout(openTimeoutRef.current);
        openTimeoutRef.current = null;
      }
      if (autoOpenedRef.current && isOpen) {
        close?.();
      }
      hasOpenedRef.current = false;
      autoOpenedRef.current = false;
      return;
    }
    if (hasOpenedRef.current) return;
    openTimeoutRef.current = setTimeout(() => {
      open?.();
      hasOpenedRef.current = true;
      autoOpenedRef.current = true;
      openTimeoutRef.current = null;
    }, 520);
  }, [enabled, open, close, isOpen]);

  return null;
}

function AutoSwitchModals({ enabled }) {
  const status = useStatus();
  const { open: openConnect, close: closeConnect, isOpen: isConnectOpen } =
    useConnectModal();
  const { open: openAccount, close: closeAccount, isOpen: isAccountOpen } =
    useAccountModal();
  const prevStatusRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      prevStatusRef.current = null;
      return;
    }
    const prev = prevStatusRef.current;
    if (prev === null) {
      prevStatusRef.current = status;
      return;
    }
    if (prev !== status) {
      if (status === ConnectionStatus.Connected) {
        if (!isAccountOpen) {
          openAccount?.();
        }
        if (isConnectOpen) {
          closeConnect?.();
        }
      }
      if (status === ConnectionStatus.Disconnected) {
        if (isAccountOpen) {
          closeAccount?.();
        }
        if (!isConnectOpen) {
          openConnect?.();
        }
      }
      prevStatusRef.current = status;
    }
  }, [
    enabled,
    status,
    isConnectOpen,
    isAccountOpen,
    openConnect,
    closeConnect,
    openAccount,
    closeAccount,
  ]);

  return null;
}

function ThemeModeSync({ mode }) {
  const { setThemeChoice } = useLunoTheme();

  useEffect(() => {
    if (!setThemeChoice) return;
    setThemeChoice(mode);
  }, [mode, setThemeChoice]);

  return null;
}

function PreviewInteractivityGuards({ enabled }) {
  useEffect(() => {
    if (!enabled) return undefined;

    const getDialog = () =>
      document.querySelector(
        "#lunokit-preview-shell [role=\"dialog\"].luno\\:fixed"
      );

    const attachPreventer = (target, eventName) => {
      if (!target?.addEventListener) return;
      target.addEventListener(
        eventName,
        (event) => {
          event.preventDefault();
        },
        { once: true }
      );
    };

    const handleDismissPointerDown = (event) => {
      const dialog = getDialog();
      if (!dialog || dialog.contains(event.target)) return;
      attachPreventer(event.target, "dismissableLayer.pointerDownOutside");
    };

    const handleDismissFocusIn = (event) => {
      const dialog = getDialog();
      if (!dialog || dialog.contains(event.target)) return;
      attachPreventer(event.target, "dismissableLayer.focusOutside");
    };

    const handleDismissKeyDown = (event) => {
      if (event.key !== "Escape") return;
      const dialog = getDialog();
      if (!dialog) return;
      event.preventDefault();
    };

    const stripBlockedAttributes = (scope) => {
      const blockedNodes = scope.querySelectorAll(
        "[aria-hidden=\"true\"], [inert], [data-aria-hidden]"
      );
      blockedNodes.forEach((node) => {
        node.removeAttribute("aria-hidden");
        node.removeAttribute("inert");
        node.removeAttribute("data-aria-hidden");
      });
      const pointerBlockedNodes = scope.querySelectorAll(
        "[style*=\"pointer-events: none\"]"
      );
      pointerBlockedNodes.forEach((node) => {
        if (node.style?.pointerEvents === "none") {
          node.style.pointerEvents = "";
        }
      });
    };

    const unlockPreviewInteractivity = () => {
      if (document.body) {
        stripBlockedAttributes(document.body);
      }
      const root = document.getElementById("root");
      if (root) {
        stripBlockedAttributes(root);
      }
    };

    const clearScrollLock = () => {
      const targets = [
        document.documentElement,
        document.body,
        document.getElementById("root"),
      ];
      targets.forEach((node) => {
        if (!node) return;
        node.removeAttribute("data-scroll-locked");
        node.removeAttribute("inert");
        if (node.getAttribute("aria-hidden") === "true") {
          node.removeAttribute("aria-hidden");
        }
        node.classList?.remove("with-scroll-bars-hidden");
        if (node.style.pointerEvents === "none") {
          node.style.pointerEvents = "";
        }
        if (node.style.overflow === "hidden") {
          node.style.overflow = "";
        }
        if (node.style.paddingRight) {
          node.style.paddingRight = "";
        }
      });
      unlockPreviewInteractivity();
    };

    const handleOutsidePointerDown = (event) => {
      const dialog = getDialog();
      if (!dialog || dialog.contains(event.target)) return;
      const target = event.target;
      if (target && typeof target.focus === "function") {
        requestAnimationFrame(() => target.focus({ preventScroll: true }));
        return;
      }
      if (target?.closest) {
        const label = target.closest("label");
        if (!label) return;
        const input = label.querySelector("input, textarea, select");
        if (input && typeof input.focus === "function") {
          requestAnimationFrame(() => input.focus({ preventScroll: true }));
        }
      }
    };

    const handleOutsideFocusIn = (event) => {
      const dialog = getDialog();
      if (!dialog || dialog.contains(event.target)) return;
      event.stopImmediatePropagation();
      event.stopPropagation();
    };

    const handleOutsideFocusOut = (event) => {
      const dialog = getDialog();
      if (!dialog || !dialog.contains(event.target)) return;
      const nextTarget = event.relatedTarget;
      if (nextTarget && !dialog.contains(nextTarget)) {
        event.stopImmediatePropagation();
        event.stopPropagation();
      }
    };

    const handleWheel = (event) => {
      const dialog = getDialog();
      if (!dialog) return;
      event.stopImmediatePropagation();
    };

    const handleTouchMove = (event) => {
      const dialog = getDialog();
      if (!dialog) return;
      event.stopImmediatePropagation();
    };

    const scrollLockObserver = new MutationObserver(clearScrollLock);
    const interactivityObserver = new MutationObserver(unlockPreviewInteractivity);

    const targets = [
      document.documentElement,
      document.body,
      document.getElementById("root"),
    ].filter(Boolean);
    targets.forEach((target) => {
      scrollLockObserver.observe(target, {
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          "data-scroll-locked",
          "inert",
          "aria-hidden",
        ],
      });
    });

    const interactivityTargets = [document.body, document.getElementById("root")].filter(
      Boolean
    );
    interactivityTargets.forEach((target) => {
      interactivityObserver.observe(target, {
        attributes: true,
        subtree: true,
        childList: true,
        attributeFilter: ["aria-hidden", "inert", "data-aria-hidden", "style"],
      });
    });

    document.addEventListener("pointerdown", handleDismissPointerDown, true);
    document.addEventListener("focusin", handleDismissFocusIn, true);
    document.addEventListener("keydown", handleDismissKeyDown, true);
    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    document.addEventListener("focusin", handleOutsideFocusIn, true);
    document.addEventListener("focusout", handleOutsideFocusOut, true);
    document.addEventListener("wheel", handleWheel, true);
    document.addEventListener("touchmove", handleTouchMove, true);

    clearScrollLock();

    return () => {
      document.removeEventListener("pointerdown", handleDismissPointerDown, true);
      document.removeEventListener("focusin", handleDismissFocusIn, true);
      document.removeEventListener("keydown", handleDismissKeyDown, true);
      document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
      document.removeEventListener("focusin", handleOutsideFocusIn, true);
      document.removeEventListener("focusout", handleOutsideFocusOut, true);
      document.removeEventListener("wheel", handleWheel, true);
      document.removeEventListener("touchmove", handleTouchMove, true);
      scrollLockObserver.disconnect();
      interactivityObserver.disconnect();
    };
  }, [enabled]);

  return null;
}

function Section({ id, title, description, actions, isOpen, onToggle, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => onToggle(id)}
          className="flex flex-1 items-center justify-between gap-4 text-left"
          aria-expanded={isOpen}
          aria-controls={`${id}-content`}
        >
          <div>
            <h2 className="font-heading text-base text-white">{title}</h2>
            {description ? (
              <p className="mt-1 text-xs text-white/50">{description}</p>
            ) : null}
          </div>
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 transition-transform ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-white/70"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>
        {actions}
      </div>
      <div
        id={`${id}-content`}
        aria-hidden={!isOpen}
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
          isOpen ? "max-h-[720px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div
          className={`px-4 ${
            isOpen
              ? "pointer-events-auto pb-4 pt-2"
              : "pointer-events-none pb-0 pt-0"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function LabelInput({ id, label, value, onChange, placeholder }) {
  return (
    <label htmlFor={id} className="space-y-2 text-sm text-white/70">
      <span className="text-xs uppercase tracking-[0.16em] text-white/50">
        {label}
      </span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={controlBase}
      />
    </label>
  );
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeHex = (value) => {
  if (!value) return null;
  let hex = value.trim().replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }
  if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
};

const hexToRgb = (value) => {
  const normalized = normalizeHex(value);
  if (normalized) {
    const raw = normalized.slice(1);
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }
  if (!value) return null;
  const match = value.trim().match(/^rgba?\((.+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(/[,/ ]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const parseChannel = (channel) => {
    const trimmed = channel.trim();
    const numeric = parseFloat(trimmed);
    if (Number.isNaN(numeric)) return 0;
    if (trimmed.endsWith("%")) {
      return clamp((numeric / 100) * 255, 0, 255);
    }
    return clamp(numeric, 0, 255);
  };
  return {
    r: parseChannel(parts[0]),
    g: parseChannel(parts[1]),
    b: parseChannel(parts[2]),
  };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

const rgbToHsv = ({ r, g, b }) => {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === r1) h = ((g1 - b1) / delta) % 6;
    if (max === g1) h = (b1 - r1) / delta + 2;
    if (max === b1) h = (r1 - g1) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
};

const hsvToRgb = ({ h, s, v }) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h >= 0 && h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h >= 60 && h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h >= 120 && h < 180) [r1, g1, b1] = [0, c, x];
  else if (h >= 180 && h < 240) [r1, g1, b1] = [0, x, c];
  else if (h >= 240 && h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
};

const ColorPickerRow = memo(function ColorPickerRow({ token, value, onChange }) {
  const rowRef = useRef(null);
  const popoverRef = useRef(null);
  const panelRef = useRef(null);
  const hueRef = useRef(null);
  const draggingPanel = useRef(false);
  const draggingHue = useRef(false);
  const rafRef = useRef(null);
  const pendingRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const rgb = useMemo(() => hexToRgb(value) || { r: 0, g: 0, b: 0 }, [value]);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [hsv, setHsv] = useState(() => rgbToHsv(rgb));

  useEffect(() => {
    setHexInput(normalizeHex(value) || rgbToHex(rgb));
    setHsv(rgbToHsv(rgb));
  }, [value, rgb.r, rgb.g, rgb.b]);

  useEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      if (!rowRef.current) return;
      const rect = rowRef.current.getBoundingClientRect();
      const popoverWidth = popoverRef.current?.offsetWidth || 360;
      const popoverHeight = popoverRef.current?.offsetHeight || 360;
      const viewportLeft = window.scrollX + 12;
      const viewportRight = window.scrollX + window.innerWidth - 12;
      const viewportTop = window.scrollY + 12;
      const viewportBottom = window.scrollY + window.innerHeight - 12;
      let left = rect.left + window.scrollX;
      let top = rect.bottom + window.scrollY + 12;
      if (left + popoverWidth > viewportRight) {
        left = viewportRight - popoverWidth;
      }
      if (left < viewportLeft) left = viewportLeft;
      if (top + popoverHeight > viewportBottom) {
        top = rect.top + window.scrollY - popoverHeight - 12;
      }
      if (top < viewportTop) top = viewportTop;
      setPopoverPosition({ top, left });
    };
    const handlePointerDown = (event) => {
      if (popoverRef.current?.contains(event.target)) return;
      if (rowRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const commitColor = useCallback(
    (nextHex) => {
      pendingRef.current = nextHex;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (!pending) return;
        onChange(token, pending);
      });
    },
    [onChange, token]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const updateFromPanel = useCallback(
    (event) => {
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const nextS = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const nextV = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
      setHsv((prev) => {
        const next = { ...prev, s: nextS, v: nextV };
        const nextHex = rgbToHex(hsvToRgb(next));
        commitColor(nextHex);
        setHexInput(nextHex);
        return next;
      });
    },
    [commitColor]
  );

  const updateFromHue = useCallback(
    (event) => {
      if (!hueRef.current) return;
      const rect = hueRef.current.getBoundingClientRect();
      const nextH = clamp((event.clientX - rect.left) / rect.width, 0, 1) * 360;
      setHsv((prev) => {
        const next = { ...prev, h: nextH };
        const nextHex = rgbToHex(hsvToRgb(next));
        commitColor(nextHex);
        setHexInput(nextHex);
        return next;
      });
    },
    [commitColor]
  );

  const handleHexChange = (event) => {
    const next = event.target.value;
    setHexInput(next);
    const normalized = normalizeHex(next);
    if (!normalized) return;
    onChange(token, normalized);
  };

  const handleHexBlur = () => {
    const normalized = normalizeHex(hexInput);
    if (normalized) {
      setHexInput(normalized);
      onChange(token, normalized);
      return;
    }
    setHexInput(normalizeHex(value) || rgbToHex(rgb));
  };

  const handleRgbChange = (channel) => (event) => {
    const nextValue = clamp(Number(event.target.value || 0), 0, 255);
    const nextRgb = { ...rgb, [channel]: nextValue };
    const nextHex = rgbToHex(nextRgb);
    onChange(token, nextHex);
    setHexInput(nextHex);
    setHsv(rgbToHsv(nextRgb));
  };

  return (
    <>
      <button
        ref={rowRef}
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-4 rounded-2xl bg-black/5 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:bg-white/10"
        aria-label={`${formatColorLabel(token)} color`}
      >
        <span
          className="h-10 w-10 shrink-0 rounded-full"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <div className="text-sm font-semibold text-white transition-colors group-hover:text-white">
          {formatColorLabel(token)}
        </div>
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="absolute z-50 w-[360px] rounded-2xl border border-white/10 bg-black/95 p-4 shadow-2xl shadow-black/70"
            style={{ top: popoverPosition.top, left: popoverPosition.left }}
          >
            <div
              ref={panelRef}
              className="relative h-[180px] w-full cursor-crosshair overflow-hidden rounded-2xl ring-1 ring-white/10"
              onPointerDown={(event) => {
                draggingPanel.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                updateFromPanel(event);
              }}
              onPointerMove={(event) => {
                if (!draggingPanel.current) return;
                updateFromPanel(event);
              }}
              onPointerUp={(event) => {
                draggingPanel.current = false;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff,transparent)]" />
              <div className="absolute inset-0 bg-[linear-gradient(to_top,#000000,transparent)]" />
              <div
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div
                className="h-8 w-8 shrink-0 rounded-lg"
                style={{ backgroundColor: value }}
                aria-hidden="true"
              />
              <div
                ref={hueRef}
                className="relative h-3 w-full cursor-pointer rounded-full"
                onPointerDown={(event) => {
                  draggingHue.current = true;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateFromHue(event);
                }}
                onPointerMove={(event) => {
                  if (!draggingHue.current) return;
                  updateFromHue(event);
                }}
                onPointerUp={(event) => {
                  draggingHue.current = false;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                style={{
                  background:
                    "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                }}
              >
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-black"
                  style={{ left: `${(hsv.h / 360) * 100}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-3 text-xs text-white/70">
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  Hex
                </span>
                <input
                  value={hexInput}
                  onChange={handleHexChange}
                  onBlur={handleHexBlur}
                  className={controlSmall}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  R
                </span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.r}
                  onChange={handleRgbChange("r")}
                  className={controlSmall}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  G
                </span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.g}
                  onChange={handleRgbChange("g")}
                  className={controlSmall}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  B
                </span>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.b}
                  onChange={handleRgbChange("b")}
                  className={controlSmall}
                />
              </label>
            </div>
          </div>,
          document.body
        )}
    </>
  );
});

function FontSelect({ value, options, onChange }) {
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (wrapperRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${controlBase} flex items-center justify-between gap-3 text-white/80`}
      >
        <span style={{ fontFamily: selected?.value }}>{selected?.label}</span>
        <span className="text-white/50">
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-white/10 bg-black p-2 shadow-2xl shadow-black/70">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                option.value === value
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
              style={{ fontFamily: option.value }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const codeKeywords = new Set([
  "import",
  "from",
  "const",
  "let",
  "var",
  "return",
  "function",
  "export",
  "default",
  "if",
  "else",
  "true",
  "false",
  "null",
  "new",
  "class",
  "extends",
  "async",
  "await",
  "try",
  "catch",
  "finally",
]);

const tokenizeCodeLine = (line) => {
  const tokens = [];
  const isWordChar = (char) => /[A-Za-z0-9_$]/.test(char);
  const isDigit = (char) => /[0-9]/.test(char);
  const getPrevNonSpace = (index) => {
    let i = index;
    while (i >= 0) {
      const char = line[i];
      if (char !== " " && char !== "\t") return char;
      i -= 1;
    }
    return "";
  };
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char === "/" && line[i + 1] === "/") {
      tokens.push({ value: line.slice(i), className: "text-[#5c6370]" });
      break;
    }
    if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      let j = i + 1;
      let escaped = false;
      while (j < line.length) {
        const next = line[j];
        if (escaped) {
          escaped = false;
          j += 1;
          continue;
        }
        if (next === "\\") {
          escaped = true;
          j += 1;
          continue;
        }
        if (next === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      tokens.push({ value: line.slice(i, j), className: "text-[#98c379]" });
      i = j;
      continue;
    }
    if (isDigit(char)) {
      let j = i + 1;
      while (j < line.length && /[0-9._]/.test(line[j])) j += 1;
      tokens.push({ value: line.slice(i, j), className: "text-[#d19a66]" });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      let j = i + 1;
      while (j < line.length && isWordChar(line[j])) j += 1;
      const word = line.slice(i, j);
      const prevChar = getPrevNonSpace(i - 1);
      if (
        prevChar === "<" ||
        (prevChar === "/" && getPrevNonSpace(i - 2) === "<")
      ) {
        tokens.push({ value: word, className: "text-[#56b6c2]" });
      } else if (codeKeywords.has(word)) {
        tokens.push({ value: word, className: "text-[#c678dd]" });
      } else if (/^[A-Z]/.test(word)) {
        tokens.push({ value: word, className: "text-[#e5c07b]" });
      } else {
        tokens.push({ value: word, className: "text-[#abb2bf]" });
      }
      i = j;
      continue;
    }
    if ("<>{}[]()".includes(char)) {
      tokens.push({ value: char, className: "text-[#89a4ff]" });
      i += 1;
      continue;
    }
    tokens.push({ value: char, className: "text-[#abb2bf]" });
    i += 1;
  }
  return tokens;
};

function CodePreview({ code, onCopy, copied }) {
  const lines = useMemo(() => code.split("\n"), [code]);
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d11] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-3 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          </span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.24em]">
            App.tsx
          </span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-full border border-white/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70 transition-colors hover:border-white/60 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-4 font-mono text-[12px] leading-6">
        <div className="space-y-0.5">
          {lines.map((line, index) => (
            <div
              key={`${index}-${line}`}
              className="grid grid-cols-[auto_1fr] gap-x-4 rounded-md px-1 py-0.5 transition-colors hover:bg-white/5"
            >
              <span className="select-none text-right tabular-nums text-white/30">
                {index + 1}
              </span>
              <span className="whitespace-pre">
                {line
                  ? tokenizeCodeLine(line).map((token, tokenIndex) => (
                      <span
                        key={`${index}-${tokenIndex}-${token.value}`}
                        className={token.className}
                      >
                        {token.value}
                      </span>
                    ))
                  : " "}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyPreview({ message }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center rounded-[32px] border border-white/10 bg-black/80 px-8 py-16 text-center">
      <p className="font-heading text-lg text-white">Preview paused</p>
      <p className="mt-2 text-sm text-white/60">{message}</p>
    </div>
  );
}

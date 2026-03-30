import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  DEFAULT_APP_STATE,
  parsePersistedAppState,
  type AppEntry,
  type PersistedAppState,
  type Workspace
} from "../shared/state";

type BrowserWebviewElement = HTMLElement & {
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  insertCSS: (css: string) => Promise<string>;
  executeJavaScript: <T = unknown>(code: string, userGesture?: boolean) => Promise<T>;
};

type AppPreset = {
  id: string;
  name: string;
  subtitle: string;
  url: string;
  iconClass: string;
};

const ICON_CHOICES = [
  "fa-solid fa-globe",
  "fa-brands fa-whatsapp",
  "fa-brands fa-amazon",
  "fa-brands fa-google",
  "fa-brands fa-youtube",
  "fa-brands fa-telegram",
  "fa-brands fa-discord",
  "fa-brands fa-slack",
  "fa-brands fa-github",
  "fa-brands fa-linkedin",
  "fa-brands fa-twitter",
  "fa-brands fa-reddit",
  "fa-solid fa-envelope",
  "fa-solid fa-briefcase",
  "fa-solid fa-cart-shopping",
  "fa-solid fa-music",
  "fa-solid fa-cloud",
  "fa-solid fa-calendar",
  "fa-solid fa-bookmark",
  "fa-solid fa-comments",
  "fa-solid fa-newspaper",
  "fa-solid fa-graduation-cap"
];

const APP_PRESETS: AppPreset[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    subtitle: "Messages",
    url: "https://web.whatsapp.com",
    iconClass: "fa-brands fa-whatsapp"
  },
  {
    id: "amazon",
    name: "Amazon",
    subtitle: "Shopping",
    url: "https://www.amazon.com",
    iconClass: "fa-brands fa-amazon"
  },
  {
    id: "youtube",
    name: "YouTube",
    subtitle: "Videos",
    url: "https://www.youtube.com",
    iconClass: "fa-brands fa-youtube"
  },
  {
    id: "slack",
    name: "Slack",
    subtitle: "Workspace chat",
    url: "https://app.slack.com/client",
    iconClass: "fa-brands fa-slack"
  },
  {
    id: "discord",
    name: "Discord",
    subtitle: "Communities",
    url: "https://discord.com/app",
    iconClass: "fa-brands fa-discord"
  },
  {
    id: "telegram",
    name: "Telegram",
    subtitle: "Cloud chat",
    url: "https://web.telegram.org",
    iconClass: "fa-brands fa-telegram"
  },
  {
    id: "github",
    name: "GitHub",
    subtitle: "Repos",
    url: "https://github.com",
    iconClass: "fa-brands fa-github"
  },
  {
    id: "notion",
    name: "Notion",
    subtitle: "Docs",
    url: "https://www.notion.so",
    iconClass: "fa-solid fa-note-sticky"
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    subtitle: "Network",
    url: "https://www.linkedin.com",
    iconClass: "fa-brands fa-linkedin"
  },
  {
    id: "reddit",
    name: "Reddit",
    subtitle: "Communities",
    url: "https://www.reddit.com",
    iconClass: "fa-brands fa-reddit"
  }
];

const getWorkspaceIconClass = (label: string): string => {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes("work")) {
    return "fa-solid fa-briefcase";
  }

  if (normalized.includes("personal")) {
    return "fa-solid fa-user";
  }

  return "fa-solid fa-layer-group";
};

export default function App() {
  const [apps, setApps] = useState<AppEntry[]>(DEFAULT_APP_STATE.apps);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(DEFAULT_APP_STATE.workspaces);
  const [activeWorkspace, setActiveWorkspace] = useState<string>(DEFAULT_APP_STATE.viewState.activeWorkspaceId);
  const [activeAppId, setActiveAppId] = useState<string>(DEFAULT_APP_STATE.viewState.activeAppId ?? "");
  const [switcherOpen, setSwitcherOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [newContainerName, setNewContainerName] = useState<string>("");
  const [renameContainerName, setRenameContainerName] = useState<string>("");
  const [newAppName, setNewAppName] = useState<string>("");
  const [newAppUrl, setNewAppUrl] = useState<string>("");
  const [newAppIconClass, setNewAppIconClass] = useState<string>(ICON_CHOICES[0]);
  const [newAppWorkspaceId, setNewAppWorkspaceId] = useState<string>(DEFAULT_APP_STATE.viewState.activeWorkspaceId);
  const [showAddApp, setShowAddApp] = useState<boolean>(false);
  const [compactSidebar, setCompactSidebar] = useState<boolean>(false);
  const [mountedWebviewIds, setMountedWebviewIds] = useState<string[]>([]);
  const [isSwitchingApp, setIsSwitchingApp] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const webviewRefs = useRef<Record<string, BrowserWebviewElement | null>>({});
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [lastLoadError, setLastLoadError] = useState<string>("");

  const workspaceApps = useMemo(
    () => apps.filter((item) => item.workspaceId === activeWorkspace),
    [activeWorkspace, apps]
  );

  const duplicateBadgeById = useMemo(() => {
    const totals = new Map<string, number>();
    const order = new Map<string, number>();
    const badges = new Map<string, number>();

    for (const item of workspaceApps) {
      const key = item.name.trim().toLowerCase();
      totals.set(key, (totals.get(key) ?? 0) + 1);
    }

    for (const item of workspaceApps) {
      const key = item.name.trim().toLowerCase();
      if ((totals.get(key) ?? 0) <= 1) {
        continue;
      }

      const nextIndex = (order.get(key) ?? 0) + 1;
      order.set(key, nextIndex);
      badges.set(item.id, nextIndex);
    }

    return badges;
  }, [workspaceApps]);

  const filteredApps = useMemo(() => {
    if (!query.trim()) {
      return workspaceApps;
    }

    const search = query.trim().toLowerCase();
    return workspaceApps.filter((item) => {
      return (
        item.name.toLowerCase().includes(search) ||
        item.subtitle.toLowerCase().includes(search) ||
        item.container.toLowerCase().includes(search)
      );
    });
  }, [workspaceApps, query]);

  const activeApp = useMemo(() => {
    const byId = apps.find((item) => item.id === activeAppId);
    return byId ?? workspaceApps[0] ?? null;
  }, [activeAppId, apps, workspaceApps]);

  const containerNames = useMemo(() => {
    return Array.from(new Set(apps.map((item) => item.container).filter((name) => name !== "Standalone")));
  }, [apps]);

  const activeContainerMembers = useMemo(() => {
    if (!activeApp || activeApp.container === "Standalone") {
      return [];
    }

    return apps.filter((item) => item.container === activeApp.container);
  }, [activeApp, apps]);

  const selectedContainerName = activeApp?.container ?? "Standalone";
  const activeContainerLabel = activeApp?.container ?? "Standalone";

  const webviewUserAgent = useMemo(() => {
    // Some sites reject Electron-specific UAs even when Chromium is modern.
    return navigator.userAgent.replace(/\sElectron\/[^\s]+/gi, "");
  }, []);

  const getPartitionForApp = (item: AppEntry): string => {
    if (item.container === "Standalone") {
      return `persist:app_${item.id}`;
    }

    const slug = item.container.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return `persist:container_${slug || "default"}`;
  };

  const activePartition = useMemo(() => {
    if (!activeApp) {
      return "persist:standalone";
    }

    return getPartitionForApp(activeApp);
  }, [activeApp]);

  const getActiveWebview = (): BrowserWebviewElement | null => {
    if (!activeApp) {
      return null;
    }

    return webviewRefs.current[activeApp.id] ?? null;
  };

  useEffect(() => {
    window.appApi
      .getState()
      .then((state) => {
        setApps(state.apps);
        setWorkspaces(state.workspaces);
        setActiveWorkspace(state.viewState.activeWorkspaceId);
        setActiveAppId(state.viewState.activeAppId ?? "");
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      void window.appApi.saveState({
        version: DEFAULT_APP_STATE.version,
        apps,
        workspaces,
        viewState: {
          activeWorkspaceId: activeWorkspace,
          activeAppId: activeAppId || null
        }
      });
    }, 150);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [activeAppId, activeWorkspace, apps, loaded, workspaces]);

  const buildPersistedState = (): PersistedAppState => {
    return {
      version: DEFAULT_APP_STATE.version,
      apps,
      workspaces,
      viewState: {
        activeWorkspaceId: activeWorkspace,
        activeAppId: activeAppId || null
      }
    };
  };

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, activeWorkspace, switcherOpen]);

  useEffect(() => {
    if (selectedContainerName === "Standalone") {
      setRenameContainerName("");
      return;
    }

    setRenameContainerName(selectedContainerName);
  }, [selectedContainerName]);

  useEffect(() => {
    if (workspaceApps.length === 0) {
      return;
    }

    const appInWorkspace = workspaceApps.some((item) => item.id === activeAppId);
    if (!appInWorkspace) {
      setActiveAppId(workspaceApps[0].id);
    }
  }, [workspaceApps, activeAppId]);

  useEffect(() => {
    if (!activeAppId) {
      return;
    }

    setIsSwitchingApp(true);
    const timeoutId = window.setTimeout(() => {
      setIsSwitchingApp(false);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeAppId]);

  useEffect(() => {
    if (!activeApp) {
      return;
    }

    setMountedWebviewIds((prev) => {
      if (prev.includes(activeApp.id)) {
        return prev;
      }

      return [...prev, activeApp.id];
    });
  }, [activeApp]);

  useEffect(() => {
    const appIdSet = new Set(apps.map((item) => item.id));
    setMountedWebviewIds((prev) => prev.filter((id) => appIdSet.has(id)));

    for (const id of Object.keys(webviewRefs.current)) {
      if (!appIdSet.has(id)) {
        delete webviewRefs.current[id];
      }
    }
  }, [apps]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSwitcherToggle = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (isSwitcherToggle) {
        event.preventDefault();
        setSwitcherOpen((prev) => !prev);
        return;
      }

      if (!switcherOpen) {
        return;
      }

      if (event.key === "Escape") {
        setSwitcherOpen(false);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          if (filteredApps.length === 0) {
            return 0;
          }

          return (prev + 1) % filteredApps.length;
        });
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          if (filteredApps.length === 0) {
            return 0;
          }

          return prev === 0 ? filteredApps.length - 1 : prev - 1;
        });
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selected = filteredApps[highlightedIndex];
        if (selected) {
          setActiveAppId(selected.id);
          setSwitcherOpen(false);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [filteredApps, highlightedIndex, switcherOpen]);

  const updateActiveAppContainer = (containerName: string) => {
    if (!activeAppId) {
      return;
    }

    setApps((prev) =>
      prev.map((item) => {
        if (item.id !== activeAppId) {
          return item;
        }

        return {
          ...item,
          container: containerName
        };
      })
    );
  };

  const confirmContainerModeSwitch = (nextContainer: string): boolean => {
    if (!activeApp) {
      return false;
    }

    const currentContainer = activeApp.container;
    if (currentContainer === nextContainer) {
      return false;
    }

    const switchingToStandalone = currentContainer !== "Standalone" && nextContainer === "Standalone";
    const switchingToContainer = currentContainer === "Standalone" && nextContainer !== "Standalone";

    if (!switchingToStandalone && !switchingToContainer) {
      return true;
    }

    const message = switchingToStandalone
      ? `Switch ${activeApp.name} to Standalone? It will stop sharing session data with container "${currentContainer}".`
      : `Switch ${activeApp.name} to container "${nextContainer}"? It will use that container's shared login/session.`;

    return window.confirm(message);
  };

  const requestContainerSwitch = (nextContainer: string) => {
    if (!confirmContainerModeSwitch(nextContainer)) {
      return;
    }

    updateActiveAppContainer(nextContainer);
  };

  const createContainerForActiveApp = () => {
    const trimmed = newContainerName.trim();
    if (!trimmed) {
      return;
    }

    updateActiveAppContainer(trimmed);
    setNewContainerName("");
  };

  const renameActiveContainer = () => {
    if (!activeApp || activeApp.container === "Standalone") {
      return;
    }

    const nextName = renameContainerName.trim();
    if (!nextName || nextName === activeApp.container) {
      return;
    }

    setApps((prev) =>
      prev.map((item) => {
        if (item.container !== activeApp.container) {
          return item;
        }

        return {
          ...item,
          container: nextName
        };
      })
    );
  };

  const deleteActiveContainer = async () => {
    if (!activeApp || activeApp.container === "Standalone") {
      return;
    }

    const containerName = activeApp.container;
    const memberCount = apps.filter((item) => item.container === containerName).length;
    const confirmed = window.confirm(
      `Delete ${containerName}? ${memberCount} app(s) will be moved to Standalone.`
    );

    if (!confirmed) {
      return;
    }

    // Clear session storage for this container partition
    await window.appApi.deleteContainerAndCleanup(containerName);

    // Update state to move all apps in this container to Standalone
    setApps((prev) =>
      prev.map((item) => {
        if (item.container !== containerName) {
          return item;
        }

        return {
          ...item,
          container: "Standalone"
        };
      })
    );
  };

  const clearActiveAppData = async () => {
    if (!activeApp) {
      return;
    }

    const confirmed = window.confirm(
      `Clear all data for ${activeApp.name}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    await window.appApi.clearAppData(activeApp.id);
  };

  const applyPresetToForm = (preset: AppPreset) => {
    setNewAppName(preset.name);
    setNewAppUrl(preset.url);
    setNewAppIconClass(preset.iconClass);
  };

  const getIconClassForApp = (item: AppEntry): string => {
    if (item.iconClass?.trim()) {
      return item.iconClass;
    }

    return "fa-solid fa-globe";
  };

  const createApp = () => {
    const trimmedName = newAppName.trim();
    const trimmedUrl = newAppUrl.trim();
    const targetWorkspaceId = newAppWorkspaceId || activeWorkspace;

    if (!trimmedName || !trimmedUrl) {
      return;
    }

    let normalizedUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      const url = new URL(normalizedUrl);
      const hostLabel = url.hostname.replace(/^www\./, "");
      const id = `${trimmedName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

      const workspaceLabel =
        workspaces.find((item) => item.id === targetWorkspaceId)?.label === "Personal" ? "Personal" : "Work";

      const nextApp: AppEntry = {
        id,
        name: trimmedName,
        subtitle: hostLabel,
        url: url.toString(),
        iconClass: newAppIconClass,
        section: workspaceLabel,
        workspaceId: targetWorkspaceId,
        container: "Standalone"
      };

      setApps((prev) => [...prev, nextApp]);
      setActiveWorkspace(targetWorkspaceId);
      setActiveAppId(nextApp.id);
      setShowAddApp(false);
      setNewAppName("");
      setNewAppUrl("");
      setNewAppIconClass(ICON_CHOICES[0]);
      setNewAppWorkspaceId(activeWorkspace);
    } catch {
      return;
    }
  };

  const deleteActiveApp = () => {
    if (!activeApp) {
      return;
    }

    deleteAppById(activeApp.id);
  };

  const deleteAppById = (appId: string) => {
    const target = apps.find((item) => item.id === appId);
    if (!target) {
      return;
    }

    const confirmed = window.confirm(`Delete ${target.name}?`);
    if (!confirmed) {
      return;
    }

    const keep = apps.filter((item) => item.id !== appId);
    setApps(keep);

    const nextInWorkspace = keep.find((item) => item.workspaceId === target.workspaceId);
    setActiveAppId(nextInWorkspace?.id ?? keep[0]?.id ?? "");
  };

  const exportState = () => {
    const payload = JSON.stringify(buildPersistedState(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "biscuit-clone-state.json";
    anchor.click();

    URL.revokeObjectURL(downloadUrl);
  };

  const importState = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const raw = await file.text();
    let parsed: PersistedAppState;
    try {
      parsed = parsePersistedAppState(JSON.parse(raw));
    } catch {
      event.target.value = "";
      return;
    }

    setApps(parsed.apps);
    setWorkspaces(parsed.workspaces);
    setActiveWorkspace(parsed.viewState.activeWorkspaceId);
    setActiveAppId(parsed.viewState.activeAppId ?? "");
    await window.appApi.saveState(parsed);
    event.target.value = "";
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      // Ignore fullscreen rejections from browser policies.
    }
  };

  const mountedApps = useMemo(() => {
    const orderedIds = activeApp
      ? [activeApp.id, ...mountedWebviewIds.filter((id) => id !== activeApp.id)]
      : mountedWebviewIds;

    return orderedIds
      .map((id) => apps.find((item) => item.id === id))
      .filter((item): item is AppEntry => Boolean(item));
  }, [activeApp, apps, mountedWebviewIds]);

  useEffect(() => {
    const webview = getActiveWebview();
    if (!webview) {
      setIsPageLoading(false);
      setCanGoBack(false);
      setCanGoForward(false);
      return;
    }

    const updateNavigationState = () => {
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };

    const handleStartLoading = () => {
      setIsPageLoading(true);
      setLastLoadError("");
      updateNavigationState();
    };

    const handleStopLoading = () => {
      setIsPageLoading(false);
      updateNavigationState();
    };

    const applyGuestScrollbarTheme = () => {
      // Keep guest-page scrollbar thin and subtle.
      void webview.insertCSS(`
        html, body {
          scrollbar-width: thin;
          scrollbar-color: rgba(107, 114, 128, 0.55) transparent;
        }

        ::-webkit-scrollbar {
          width: 9px;
          height: 9px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(107, 114, 128, 0.45);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: content-box;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(75, 85, 99, 0.7);
          border: 2px solid transparent;
          background-clip: content-box;
        }
      `);
    };

    const handleLoadFail = (event: Event) => {
      const failed = event as Event & { errorCode?: number; errorDescription?: string };
      if (failed.errorCode === -3) {
        return;
      }

      setIsPageLoading(false);
      setLastLoadError(failed.errorDescription || "Failed to load page");
      updateNavigationState();
    };

    const handleDomReady = () => {
      updateNavigationState();
      applyGuestScrollbarTheme();
    };

    webview.addEventListener("did-start-loading", handleStartLoading);
    webview.addEventListener("did-stop-loading", handleStopLoading);
    webview.addEventListener("did-fail-load", handleLoadFail);
    webview.addEventListener("did-navigate", updateNavigationState);
    webview.addEventListener("did-navigate-in-page", updateNavigationState);
    webview.addEventListener("dom-ready", handleDomReady);

    return () => {
      webview.removeEventListener("did-start-loading", handleStartLoading);
      webview.removeEventListener("did-stop-loading", handleStopLoading);
      webview.removeEventListener("did-fail-load", handleLoadFail);
      webview.removeEventListener("did-navigate", updateNavigationState);
      webview.removeEventListener("did-navigate-in-page", updateNavigationState);
      webview.removeEventListener("dom-ready", handleDomReady);
    };
  }, [activeAppId, activePartition, mountedWebviewIds]);

  return (
    <div className="app-shell">
      <header className="chrome-bar">
        <div className="address-pill">{activeApp?.url ?? "https://"}</div>
        <div className="header-actions">
          <button
            type="button"
            className="toolbar-button"
            disabled={!canGoBack}
            onClick={() => getActiveWebview()?.goBack()}
          >
            Back
          </button>
          <button
            type="button"
            className="toolbar-button"
            disabled={!canGoForward}
            onClick={() => getActiveWebview()?.goForward()}
          >
            Forward
          </button>
          <button type="button" className="toolbar-button" onClick={() => getActiveWebview()?.reload()}>
            Reload
          </button>
          <button type="button" className="toolbar-button" onClick={() => void toggleFullscreen()}>
            Fullscreen
          </button>
          <div className="container-indicator" title={`Current container: ${activeContainerLabel}`}>
            <span className="container-indicator-label">Container</span>
            <span
              className={`container-indicator-value ${
                activeContainerLabel === "Standalone" ? "standalone" : "shared"
              }`}
            >
              {activeContainerLabel}
            </span>
          </div>
          <span className="toolbar-state">
            {isPageLoading ? "Loading..." : lastLoadError ? `Error: ${lastLoadError}` : "Ready"}
          </span>
          <button
            type="button"
            className="toolbar-icon-button settings-trigger"
            aria-label="Open settings"
            title="Settings"
            onClick={() => setSettingsOpen((prev) => !prev)}
          >
            <i className="fa-solid fa-gear" aria-hidden="true" />
          </button>
          <div className="window-controls-right">
            <button
              type="button"
              className="window-control-button"
              aria-label="Minimize window"
              onClick={() => void window.appApi.minimizeWindow()}
            >
              _
            </button>
            <button
              type="button"
              className="window-control-button"
              aria-label="Maximize or restore window"
              onClick={() => void window.appApi.toggleMaximizeWindow()}
            >
              □
            </button>
            <button
              type="button"
              className="window-control-button close"
              aria-label="Close window"
              onClick={() => void window.appApi.closeWindow()}
            >
              ×
            </button>
          </div>
        </div>
      </header>

      <div className={`layout ${compactSidebar ? "compact" : ""}`}>
        <aside className="sidebar">
          <div className="sidebar-head">
            <div className="brand">Biscuit Clone</div>
            <button
              type="button"
              className="compact-toggle"
              title={compactSidebar ? "Expand sidebar" : "Compact sidebar"}
              aria-label={compactSidebar ? "Expand sidebar" : "Compact sidebar"}
              onClick={() => setCompactSidebar((prev) => !prev)}
            >
              <i className={`fa-solid ${compactSidebar ? "fa-angles-right" : "fa-angles-left"}`} aria-hidden="true" />
            </button>
          </div>
          <div className="workspace-tabs">
            <button
              type="button"
              className="workspace-pill add"
              title={showAddApp ? "Close Add App" : "Add App"}
              onClick={() => {
                setShowAddApp((prev) => {
                  const next = !prev;
                  if (next) {
                    setCompactSidebar(false);
                    setNewAppWorkspaceId(activeWorkspace);
                    setNewAppIconClass(ICON_CHOICES[0]);
                  }
                  return next;
                });
              }}
            >
              <i className={`fa-solid ${showAddApp ? "fa-xmark" : "fa-plus"}`} aria-hidden="true" />
              <span>{showAddApp ? "Close" : "Add App"}</span>
            </button>
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                className={`workspace-pill ${activeWorkspace === workspace.id ? "active" : ""}`}
                title={workspace.label}
                onClick={() => setActiveWorkspace(workspace.id)}
              >
                <i className={getWorkspaceIconClass(workspace.label)} aria-hidden="true" />
                <span>{workspace.label}</span>
              </button>
            ))}

            {showAddApp ? (
              <div className="add-app-panel">
                <div className="preset-grid" aria-label="App presets">
                  {APP_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="preset-chip"
                      onClick={() => applyPresetToForm(preset)}
                    >
                      <i className={preset.iconClass} aria-hidden="true" />
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
                <input
                  className="add-app-input"
                  placeholder="App name"
                  value={newAppName}
                  onChange={(event) => setNewAppName(event.target.value)}
                />
                <input
                  className="add-app-input"
                  placeholder="https://example.com"
                  value={newAppUrl}
                  onChange={(event) => setNewAppUrl(event.target.value)}
                />
                <select
                  className="add-app-input"
                  value={newAppWorkspaceId}
                  onChange={(event) => setNewAppWorkspaceId(event.target.value)}
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.label}
                    </option>
                  ))}
                </select>
                <div className="icon-picker" aria-label="Icon picker">
                  {ICON_CHOICES.map((iconClass) => (
                    <button
                      key={iconClass}
                      type="button"
                      className={`icon-choice ${newAppIconClass === iconClass ? "active" : ""}`}
                      title={iconClass}
                      onClick={() => setNewAppIconClass(iconClass)}
                    >
                      <i className={iconClass} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <button type="button" className="add-app-submit" onClick={createApp}>
                  Save App
                </button>
              </div>
            ) : null}
          </div>

          <div className="section-label">Apps</div>
          <div className="app-list">
            {workspaceApps.map((item) => (
              <div key={item.id} className={`app-item-row ${activeAppId === item.id ? "active" : ""}`}>
                <button
                  type="button"
                  className={`app-item ${activeAppId === item.id ? "active" : ""}`}
                  title={item.name}
                  onClick={() => setActiveAppId(item.id)}
                >
                  <span className="app-icon-wrap">
                    <i className={`app-icon ${getIconClassForApp(item)}`} aria-hidden="true" />
                    {duplicateBadgeById.has(item.id) ? (
                      <span className="app-instance-badge">{duplicateBadgeById.get(item.id)}</span>
                    ) : null}
                  </span>
                  <span className="app-labels">
                    <span className="app-title">{item.name}</span>
                    <span className="app-subtitle">{item.subtitle}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="app-item-remove"
                  aria-label={`Delete ${item.name}`}
                  onClick={() => deleteAppById(item.id)}
                >
                  ×
                </button>
              </div>
            ))}
            {workspaceApps.length === 0 ? <div className="empty-state">No apps in this workspace.</div> : null}
          </div>
        </aside>

        <main className="main-panel">
          <div className={`browser-panel ${isSwitchingApp ? "switching" : ""}`}>
            {activeApp ? (
              <div className="webview-stack">
                {mountedApps.map((item) => {
                  const partition = getPartitionForApp(item);
                  const isActive = item.id === activeApp.id;

                  return (
                    <webview
                      ref={(node) => {
                        webviewRefs.current[item.id] = node as BrowserWebviewElement | null;
                      }}
                      key={`${item.id}-${partition}`}
                      src={item.url}
                      partition={partition}
                      className={`webview-host ${isActive ? "active" : "hidden"}`}
                      useragent={webviewUserAgent}
                      allowpopups={false}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="webview-empty">Create or select an app to start browsing.</div>
            )}
          </div>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden-file-input"
            onChange={importState}
          />

          {settingsOpen ? (
            <div className="settings-overlay" role="presentation" onClick={() => setSettingsOpen(false)}>
              <section className="settings-popup" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                <div className="settings-heading">App Settings</div>

                <div className="settings-actions">
                  <button type="button" className="ghost-button" onClick={() => importInputRef.current?.click()}>
                    Import
                  </button>
                  <button type="button" className="ghost-button" onClick={exportState}>
                    Export
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setSwitcherOpen(true)}>
                    Open Switcher
                  </button>
                </div>

                <div className="settings-actions">
                  <button type="button" className="danger-chip" onClick={clearActiveAppData}>
                    Clear Data
                  </button>
                  <button type="button" className="danger-chip" onClick={deleteActiveApp}>
                    Delete App
                  </button>
                </div>

                <div className="session-header">Session Mode</div>
                <div className="mode-toggle">
                  <button
                    type="button"
                    className={`mode-button ${activeApp?.container === "Standalone" ? "active" : ""}`}
                    onClick={() => requestContainerSwitch("Standalone")}
                  >
                    Standalone
                  </button>
                  <button
                    type="button"
                    className={`mode-button ${activeApp?.container !== "Standalone" ? "active" : ""}`}
                    onClick={() => {
                      if (containerNames.length > 0) {
                        requestContainerSwitch(containerNames[0]);
                      }
                    }}
                  >
                    Use Container
                  </button>
                </div>

                {activeApp?.container !== "Standalone" ? (
                  <div className="container-controls">
                    <label className="inline-label" htmlFor="container-select">
                      Container
                    </label>
                    <select
                      id="container-select"
                      className="container-select"
                      value={activeApp?.container ?? ""}
                      onChange={(event) => requestContainerSwitch(event.target.value)}
                    >
                      {containerNames.map((container) => (
                        <option key={container} value={container}>
                          {container}
                        </option>
                      ))}
                    </select>

                    <div className="new-container-row">
                      <input
                        className="new-container-input"
                        placeholder="Create container"
                        value={newContainerName}
                        onChange={(event) => setNewContainerName(event.target.value)}
                      />
                      <button type="button" className="new-container-button" onClick={createContainerForActiveApp}>
                        Add
                      </button>
                    </div>

                    <div className="new-container-row">
                      <input
                        className="new-container-input"
                        placeholder="Rename selected container"
                        value={renameContainerName}
                        onChange={(event) => setRenameContainerName(event.target.value)}
                      />
                      <button type="button" className="new-container-button" onClick={renameActiveContainer}>
                        Rename
                      </button>
                    </div>

                    <div className="danger-row">
                      <button type="button" className="danger-action" onClick={() => void deleteActiveContainer()}>
                        Delete Container
                      </button>
                    </div>

                    <div className="members-line">
                      Members: {activeContainerMembers.map((item) => item.name).join(", ") || "None"}
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </main>
      </div>

      {switcherOpen ? (
        <div className="switcher-overlay" role="presentation" onClick={() => setSwitcherOpen(false)}>
          <section className="switcher" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <input
              autoFocus
              className="switcher-input"
              placeholder="Search apps, containers, or accounts"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="switcher-list">
              {filteredApps.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`switcher-item ${highlightedIndex === index ? "highlighted" : ""}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => {
                    setActiveAppId(item.id);
                    setSwitcherOpen(false);
                  }}
                >
                  <div>
                    <div className="switcher-title">{item.name}</div>
                    <div className="switcher-subtitle">{item.subtitle}</div>
                  </div>
                  <span className="switcher-container">{item.container}</span>
                </button>
              ))}
              {filteredApps.length === 0 ? <div className="empty-state">No apps found</div> : null}
            </div>
            <footer className="switcher-hint">arrow keys to navigate · enter to select · esc to dismiss</footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

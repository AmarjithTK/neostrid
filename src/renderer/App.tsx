import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { PingResponse } from "../shared/ipc";
import {
  DEFAULT_APP_STATE,
  parsePersistedAppState,
  type AppEntry,
  type PersistedAppState,
  type Workspace
} from "../shared/state";

export default function App() {
  const [apps, setApps] = useState<AppEntry[]>(DEFAULT_APP_STATE.apps);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(DEFAULT_APP_STATE.workspaces);
  const [pong, setPong] = useState<PingResponse | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<string>(DEFAULT_APP_STATE.viewState.activeWorkspaceId);
  const [activeAppId, setActiveAppId] = useState<string>(DEFAULT_APP_STATE.viewState.activeAppId ?? "");
  const [switcherOpen, setSwitcherOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [newContainerName, setNewContainerName] = useState<string>("");
  const [newAppName, setNewAppName] = useState<string>("");
  const [newAppUrl, setNewAppUrl] = useState<string>("");
  const [showAddApp, setShowAddApp] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const workspaceApps = useMemo(
    () => apps.filter((item) => item.workspaceId === activeWorkspace),
    [activeWorkspace, apps]
  );

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

  useEffect(() => {
    window.appApi.ping("renderer-ready").then(setPong).catch(() => {
      setPong(null);
    });

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
    if (workspaceApps.length === 0) {
      return;
    }

    const appInWorkspace = workspaceApps.some((item) => item.id === activeAppId);
    if (!appInWorkspace) {
      setActiveAppId(workspaceApps[0].id);
    }
  }, [workspaceApps, activeAppId]);

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

  const createContainerForActiveApp = () => {
    const trimmed = newContainerName.trim();
    if (!trimmed) {
      return;
    }

    updateActiveAppContainer(trimmed);
    setNewContainerName("");
  };

  const createApp = () => {
    const trimmedName = newAppName.trim();
    const trimmedUrl = newAppUrl.trim();

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
        workspaces.find((item) => item.id === activeWorkspace)?.label === "Personal" ? "Personal" : "Work";

      const nextApp: AppEntry = {
        id,
        name: trimmedName,
        subtitle: hostLabel,
        url: url.toString(),
        section: workspaceLabel,
        workspaceId: activeWorkspace,
        container: "Standalone"
      };

      setApps((prev) => [...prev, nextApp]);
      setActiveAppId(nextApp.id);
      setShowAddApp(false);
      setNewAppName("");
      setNewAppUrl("");
    } catch {
      return;
    }
  };

  const deleteActiveApp = () => {
    if (!activeApp) {
      return;
    }

    const keep = apps.filter((item) => item.id !== activeApp.id);
    setApps(keep);

    const nextInWorkspace = keep.find((item) => item.workspaceId === activeWorkspace);
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

  const groupedApps = useMemo(() => {
    return {
      Work: workspaceApps.filter((item) => item.section === "Work"),
      Personal: workspaceApps.filter((item) => item.section === "Personal")
    };
  }, [workspaceApps]);

  return (
    <div className="app-shell">
      <header className="chrome-bar">
        <div className="traffic-controls">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
        <div className="address-pill">{activeApp?.url ?? "https://"}</div>
        <div className="header-actions">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden-file-input"
            onChange={importState}
          />
          <button
            type="button"
            className="ghost-button"
            onClick={() => importInputRef.current?.click()}
          >
            Import
          </button>
          <button type="button" className="ghost-button" onClick={exportState}>
            Export
          </button>
          <button type="button" className="ghost-button" onClick={() => setSwitcherOpen(true)}>
            Open Switcher
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="brand">Biscuit Clone</div>
          <div className="workspace-tabs">
            <button type="button" className="workspace-pill add" onClick={() => setShowAddApp((prev) => !prev)}>
              + Add App
            </button>
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                className={`workspace-pill ${activeWorkspace === workspace.id ? "active" : ""}`}
                onClick={() => setActiveWorkspace(workspace.id)}
              >
                {workspace.label}
              </button>
            ))}

            {showAddApp ? (
              <div className="add-app-panel">
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
                <button type="button" className="add-app-submit" onClick={createApp}>
                  Save App
                </button>
              </div>
            ) : null}
          </div>

          <div className="section-label">Work</div>
          <div className="app-list">
            {groupedApps.Work.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`app-item ${activeAppId === item.id ? "active" : ""}`}
                onClick={() => setActiveAppId(item.id)}
              >
                <span className="app-title">{item.name}</span>
                <span className="app-subtitle">{item.subtitle}</span>
              </button>
            ))}
          </div>

          <div className="section-label">Personal</div>
          <div className="app-list">
            {groupedApps.Personal.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`app-item ${activeAppId === item.id ? "active" : ""}`}
                onClick={() => setActiveAppId(item.id)}
              >
                <span className="app-title">{item.name}</span>
                <span className="app-subtitle">{item.subtitle}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="main-panel">
          <div className="top-row">
            <h1>{activeApp?.name ?? "No app selected"}</h1>
            <div className="app-meta">
              <span className="meta-chip">{activeWorkspace.toUpperCase()}</span>
              <span className="meta-chip">{activeApp?.container ?? "Standalone"}</span>
              <button type="button" className="danger-chip" onClick={deleteActiveApp}>
                Delete App
              </button>
            </div>
          </div>

          <section className="session-panel">
            <div className="session-header">Session Mode</div>
            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-button ${activeApp?.container === "Standalone" ? "active" : ""}`}
                onClick={() => updateActiveAppContainer("Standalone")}
              >
                Standalone
              </button>
              <button
                type="button"
                className={`mode-button ${activeApp?.container !== "Standalone" ? "active" : ""}`}
                onClick={() => {
                  if (containerNames.length > 0) {
                    updateActiveAppContainer(containerNames[0]);
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
                  onChange={(event) => updateActiveAppContainer(event.target.value)}
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

                <div className="members-line">
                  Members: {activeContainerMembers.map((item) => item.name).join(", ") || "None"}
                </div>
              </div>
            ) : null}
          </section>

          <div className="content-mock">
            <div className="calendar-strip" />
            <div className="calendar-strip" />
            <div className="calendar-strip" />
            <div className="calendar-strip" />
            <div className="calendar-strip" />
            <div className="calendar-strip" />
          </div>

          <div className="ping-card">
            <div className="section-label light">Typed IPC Ping</div>
            <pre>{pong ? JSON.stringify(pong, null, 2) : "Waiting for response..."}</pre>
          </div>
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

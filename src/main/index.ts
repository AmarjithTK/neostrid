import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { IPC_CHANNELS, type PingResponse } from "../shared/ipc";
import {
  DEFAULT_APP_STATE,
  parsePersistedAppState,
  type PersistedAppState
} from "../shared/state";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let appState: PersistedAppState = DEFAULT_APP_STATE;
const BROWSER_LIKE_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const patchedSessionPartitions = new Set<string>();

function toBrowserLikeUserAgent(raw: string): string {
  // Remove Electron marker so strict UA checks treat it as standard Chromium.
  return raw.replace(/\sElectron\/[^\s]+/gi, "");
}

function patchSessionHeaders(targetSession: Electron.Session, partitionKey: string): void {
  if (patchedSessionPartitions.has(partitionKey)) {
    return;
  }

  patchedSessionPartitions.add(partitionKey);

  targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    requestHeaders["User-Agent"] = BROWSER_LIKE_USER_AGENT;

    // Keep UA and client hints consistent to avoid browser-gating mismatches.
    for (const key of Object.keys(requestHeaders)) {
      if (/^sec-ch-ua/i.test(key)) {
        delete requestHeaders[key];
      }
    }

    callback({ requestHeaders });
  });
}

function getStateFilePath(): string {
  return join(app.getPath("userData"), "state.json");
}

async function readStateFromDisk(): Promise<PersistedAppState> {
  try {
    const raw = await readFile(getStateFilePath(), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return parsePersistedAppState(parsed);
  } catch {
    return DEFAULT_APP_STATE;
  }
}

async function writeStateToDisk(nextState: PersistedAppState): Promise<void> {
  const filePath = getStateFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(nextState, null, 2), "utf-8");
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    autoHideMenuBar: true,
    backgroundColor: "#111827",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,              // Isolate preload from renderer context
      nodeIntegration: false,              // Disable Node.js integration in renderer
      sandbox: false,                      // Required for webviewTag to host browser tabs
      webviewTag: true,                    // Enable webview tag for in-app browser
      allowRunningInsecureContent: false   // Prevent mixed-content
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL as string);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    void win.loadFile(join(app.getAppPath(), "dist/index.html"));
  }

  win.setMenuBarVisibility(false);

  return win;
}

app.whenReady().then(() => {
  void readStateFromDisk().then((loaded) => {
    appState = loaded;
  });

  app.userAgentFallback = BROWSER_LIKE_USER_AGENT;
  patchSessionHeaders(session.defaultSession, "default");

  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (_attachEvent, _webPreferences, params) => {
      const partition = typeof params.partition === "string" && params.partition.length > 0 ? params.partition : "default";
      const webviewSession = session.fromPartition(partition);

      patchSessionHeaders(webviewSession, partition);

      const currentUserAgent = typeof params.useragent === "string" ? params.useragent : BROWSER_LIKE_USER_AGENT;
      params.useragent = toBrowserLikeUserAgent(currentUserAgent);
    });
  });

  // Enforce CSP in production only. Dev/HMR needs broader script/connect allowances.
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self' file:; " +
            "script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https: file:; " +
            "font-src 'self' data: file:; " +
            "connect-src 'self' https: file:; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self';"
          ]
        }
      });
    });
  }

  ipcMain.handle(IPC_CHANNELS.ping, (_event, message: string): PingResponse => {
    return {
      ok: true,
      message: `Main received: ${message}`,
      timestamp: new Date().toISOString()
    };
  });

  ipcMain.handle(IPC_CHANNELS.getState, async () => {
    appState = await readStateFromDisk();
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.saveState, async (_event, nextState: PersistedAppState) => {
    const parsed = parsePersistedAppState(nextState);
    appState = parsed;
    await writeStateToDisk(parsed);
    return appState;
  });

  ipcMain.handle(IPC_CHANNELS.deleteContainerAndCleanup, async (_event, containerName: string) => {
    const slug = containerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const partitionName = `persist:container_${slug || "default"}`;
    
    try {
      const targetSession = session.fromPartition(partitionName);
      await targetSession.clearStorageData();
    } catch (err) {
      console.error(`Failed to clear storage for container ${containerName}:`, err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.clearAppData, async (_event, appId: string) => {
    const partitionName = `persist:app_${appId}`;
    
    try {
      const targetSession = session.fromPartition(partitionName);
      await targetSession.clearStorageData();
    } catch (err) {
      console.error(`Failed to clear storage for app ${appId}:`, err);
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

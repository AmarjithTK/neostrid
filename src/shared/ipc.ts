import type { PersistedAppState } from "./state";

export const IPC_CHANNELS = {
  ping: "app:ping",
  getState: "state:get",
  saveState: "state:save",
  deleteContainerAndCleanup: "container:deleteAndCleanup",
  clearAppData: "app:clearData"
} as const;

export type PingResponse = {
  ok: true;
  message: string;
  timestamp: string;
};

export type AppApi = {
  ping: (message: string) => Promise<PingResponse>;
  getState: () => Promise<PersistedAppState>;
  saveState: (nextState: PersistedAppState) => Promise<PersistedAppState>;
  deleteContainerAndCleanup: (containerName: string) => Promise<void>;
  clearAppData: (appId: string) => Promise<void>;
};

declare global {
  interface Window {
    appApi: AppApi;
  }
}

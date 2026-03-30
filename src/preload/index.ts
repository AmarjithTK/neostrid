import { contextBridge, ipcRenderer } from "electron";
import type { AppApi, PingResponse } from "../shared/ipc";
import { IPC_CHANNELS } from "../shared/ipc";
import type { PersistedAppState } from "../shared/state";

const appApi: AppApi = {
  ping: async (message: string): Promise<PingResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.ping, message);
  },
  getState: async (): Promise<PersistedAppState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.getState);
  },
  saveState: async (nextState: PersistedAppState): Promise<PersistedAppState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.saveState, nextState);
  },
  deleteContainerAndCleanup: async (containerName: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.deleteContainerAndCleanup, containerName);
  },
  clearAppData: async (appId: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.clearAppData, appId);
  },
  minimizeWindow: async (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.windowMinimize);
  },
  toggleMaximizeWindow: async (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.windowToggleMaximize);
  },
  closeWindow: async (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.windowClose);
  }
};

contextBridge.exposeInMainWorld("appApi", appApi);

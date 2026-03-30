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
  }
};

contextBridge.exposeInMainWorld("appApi", appApi);

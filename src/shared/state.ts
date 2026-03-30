import { z } from "zod";

export const APP_STATE_VERSION = 1;

export const APP_ENTRY_SCHEMA = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subtitle: z.string().min(1),
  url: z.string().url(),
  section: z.enum(["Work", "Personal"]),
  workspaceId: z.string().min(1),
  container: z.string().min(1)
});

export const WORKSPACE_SCHEMA = z.object({
  id: z.string().min(1),
  label: z.string().min(1)
});

export const VIEW_STATE_SCHEMA = z.object({
  activeWorkspaceId: z.string().min(1),
  activeAppId: z.string().nullable()
});

export const APP_STATE_SCHEMA = z.object({
  version: z.literal(APP_STATE_VERSION),
  workspaces: z.array(WORKSPACE_SCHEMA),
  apps: z.array(APP_ENTRY_SCHEMA),
  viewState: VIEW_STATE_SCHEMA
});

export type AppEntry = z.infer<typeof APP_ENTRY_SCHEMA>;
export type Workspace = z.infer<typeof WORKSPACE_SCHEMA>;
export type ViewState = z.infer<typeof VIEW_STATE_SCHEMA>;
export type PersistedAppState = z.infer<typeof APP_STATE_SCHEMA>;

export const DEFAULT_APP_STATE: PersistedAppState = {
  version: APP_STATE_VERSION,
  workspaces: [
    { id: "work", label: "Work" },
    { id: "personal", label: "Personal" }
  ],
  apps: [
    {
      id: "gmail-work",
      name: "Gmail",
      subtitle: "Work account",
      url: "https://mail.google.com",
      section: "Work",
      workspaceId: "work",
      container: "Container A"
    },
    {
      id: "drive-work",
      name: "Drive",
      subtitle: "Work files",
      url: "https://drive.google.com",
      section: "Work",
      workspaceId: "work",
      container: "Container A"
    },
    {
      id: "calendar-work",
      name: "Calendar",
      subtitle: "Team schedule",
      url: "https://calendar.google.com/calendar/r",
      section: "Work",
      workspaceId: "work",
      container: "Container A"
    },
    {
      id: "notion-work",
      name: "Notion",
      subtitle: "Project docs",
      url: "https://www.notion.so",
      section: "Work",
      workspaceId: "work",
      container: "Container A"
    },
    {
      id: "github-work",
      name: "GitHub",
      subtitle: "Code reviews",
      url: "https://github.com",
      section: "Work",
      workspaceId: "work",
      container: "Standalone"
    },
    {
      id: "gmail-personal",
      name: "Gmail",
      subtitle: "Personal account",
      url: "https://mail.google.com",
      section: "Personal",
      workspaceId: "personal",
      container: "Container B"
    },
    {
      id: "drive-personal",
      name: "Drive",
      subtitle: "Personal files",
      url: "https://drive.google.com",
      section: "Personal",
      workspaceId: "personal",
      container: "Container B"
    },
    {
      id: "messenger",
      name: "Messenger",
      subtitle: "Friends and family",
      url: "https://www.messenger.com",
      section: "Personal",
      workspaceId: "personal",
      container: "Standalone"
    }
  ],
  viewState: {
    activeWorkspaceId: "work",
    activeAppId: "calendar-work"
  }
};

export function parsePersistedAppState(input: unknown): PersistedAppState {
  return APP_STATE_SCHEMA.parse(input);
}

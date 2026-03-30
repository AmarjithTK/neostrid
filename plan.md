# Biscuit-Style App Plan Of Action

## 1. Product Goal
Build a fast desktop "app browser" where users pin web apps in a sidebar, switch instantly, and choose between standalone app sessions or reusable session containers.

## 2. Success Criteria (MVP)
1. User can add, edit, remove, and reorder apps in a sidebar.
2. User can create workspaces and move apps between workspaces.
3. Each app/account runs in isolated session storage (no cookie sharing by default).
4. User can create named containers and attach multiple apps to the same container so one login can be reused.
5. App state restores on relaunch (workspaces, apps, active app, window settings).
6. Keyboard app switcher works reliably.
7. Linux, macOS, and Windows builds can be generated.

## 3. Tech Stack
- Runtime: Electron (latest stable).
- UI: React + TypeScript + Vite.
- State: Zustand or Redux Toolkit (choose one and keep it consistent).
- Persistence: local JSON DB (better-sqlite3 is optional for v2).
- Validation: Zod for config/schema safety.
- Packaging: electron-builder.
- Testing: Vitest (unit) + Playwright (critical E2E flows).

## 4. System Design
### 4.1 Core Processes
- Main process: window lifecycle, security policies, app storage API, updater wiring.
- Renderer process: sidebar/workspace UI, command palette, settings.
- Preload bridge: strict IPC contract only (no Node exposure in renderer).

### 4.2 Data Model
- Workspace: id, name, order, icon.
- AppItem: id, workspaceId, name, url, icon, sessionMode, partitionId, containerId, notificationPolicy, order.
- ViewState: activeWorkspaceId, activeAppId, splitterWidth, theme, shortcuts.
- SessionMeta: partitionId, label, createdAt, lastUsedAt.
- SessionContainer: id, name, partitionId, memberAppIds, createdAt, lastUsedAt.

### 4.3 Isolation Strategy
- One persistent Electron partition per app account (`persist:app_<id>`).
- Container mode uses container partitions (`persist:container_<id>`) that multiple apps can point to.
- Per-app toggle in settings: `Standalone` (default) or `Use Container`.
- Container assignment is app-agnostic (works for Gmail, Drive, Notion, and any web app).
- Container lifecycle: create, rename, attach app, detach app, delete container (only when empty or with explicit confirmation).
- Optional "temporary/private" partition for ephemeral sessions.
- Guardrails: strict allowlist for permissions and popups.

## 5. Delivery Roadmap
## Phase 0: Bootstrap (Day 1)
1. Initialize Electron + React + TypeScript workspace.
2. Add linting, formatting, and CI checks.
3. Establish folder structure:
	- `src/main`
	- `src/preload`
	- `src/renderer`
	- `src/shared`
4. Define IPC contract types in shared layer.

Exit criteria:
- App launches with blank shell window and typed IPC ping.

## Phase 1: Sidebar + App Shell (Days 2-3)
1. Implement sidebar list and workspace switcher UI.
2. Add app CRUD (add/edit/delete/reorder).
3. Embed webview container with active app switching.
4. Add loading/error states for failed URLs.

Exit criteria:
- User can manage apps and open/switch them in a single workspace.

## Phase 2: Session Isolation (Days 4-5)
1. Assign deterministic partition IDs per app account.
2. Enforce isolation in webview/browserview creation.
3. Add account duplication flow (same URL, separate partition).
4. Add container toggle flow:
	- switch app between `Standalone` and `Use Container`
	- create/select container
	- rebind app to target container partition
5. Add container management UI: create/rename/delete and member list.
6. Add "clear app data" action for standalone app partition or entire container partition.

Exit criteria:
- Two accounts of same service stay logged in independently.
- Apps linked to the same container reuse one login session.
- Standalone apps remain isolated even when containers exist.

## Phase 3: Persistence + Restore (Days 6-7)
1. Persist workspaces/apps/view state atomically.
2. Restore previous active workspace/app on startup.
3. Add import/export of user config JSON.
4. Add migration versioning for schema updates.

Exit criteria:
- App reopens exactly where user left off.

## Phase 4: Productivity Layer (Days 8-10)
1. Keyboard switcher (quick open for apps/workspaces).
2. Per-app notification toggle + global mute.
3. Quick actions: reload, copy URL/title, open in external browser.
4. Basic command palette.

Exit criteria:
- Fast keyboard-first workflow works end-to-end.

## Phase 5: Hardening + Packaging (Days 11-14)
1. Security review:
	- `contextIsolation: true`
	- `sandbox: true` where possible
	- `nodeIntegration: false`
	- navigation and permission filtering
2. Performance pass:
	- background tab throttling
	- memory caps and idle unloading strategy
3. Cross-platform packaging and smoke tests.
4. Add crash logging and diagnostics bundle.

Exit criteria:
- Signed release candidates produced for all target OSes.

## 6. Security Checklist
- No arbitrary IPC channels.
- URL validation before opening any target.
- Restrict new-window behavior and external URL handling.
- Content Security Policy for renderer UI.
- Dependabot/security updates enabled.

## 7. Testing Strategy
1. Unit tests:
	- state reducers/store actions
	- schema validation and migrations
	- partition ID generation
2. E2E tests:
	- add app -> open -> persist -> relaunch restore
	- duplicate account isolation
	- enable `Use Container` for Gmail + Drive and verify single login
	- add Notion to same container and verify shared authenticated state when identity provider is shared
	- keep one app in `Standalone` mode and verify no cookie/session leakage from container apps
	- workspace switching and reorder persistence
3. Manual compatibility pass:
	- Google Workspace, Slack, GitHub, Notion, X/Twitter

## 8. Risks And Mitigations
1. High memory usage:
	- Mitigation: lazy load inactive views + unload dormant webviews.
2. Site incompatibilities:
	- Mitigation: per-app user agent overrides and fallback open-in-default-browser.
3. Shared login is not universal across all apps:
	- Mitigation: document that containers share cookies/storage, but login reuse still depends on each site's auth flow, cookie policy, and IdP behavior.
4. Security regression:
	- Mitigation: locked-down preload API and automated security lint checks.
5. Data corruption:
	- Mitigation: atomic writes + backups + schema migrations.

## 9. Definition Of Done (MVP)
1. Core features in Success Criteria complete.
2. Test suite green in CI.
3. Security checklist items validated.
4. Release build installable on Linux/macOS/Windows.
5. Basic docs complete: setup, architecture, troubleshooting, release process.

## 10. Immediate Next Actions
1. Create the Electron + React + TypeScript scaffold.
2. Implement typed IPC bridge and app/workspace models.
3. Build sidebar and webview host with one sample app.
4. Add persistence layer and restore flow before adding advanced features.
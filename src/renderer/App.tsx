import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  DEFAULT_APP_STATE,
  parsePersistedAppState,
  type AppEntry,
  type PersistedAppState,
  type Workspace
} from "../shared/state";
import neostridLauncherIcon from "./assets/neostrid-launcher.png";

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

type IconChoice = {
  iconClass: string;
  label: string;
  tags: string[];
};

const ICON_CATALOG: IconChoice[] = [
  { iconClass: "fa-solid fa-globe", label: "Globe", tags: ["web", "browser", "default"] },
  { iconClass: "fa-brands fa-whatsapp", label: "WhatsApp", tags: ["chat", "message"] },
  { iconClass: "fa-brands fa-amazon", label: "Amazon", tags: ["shopping", "store"] },
  { iconClass: "fa-brands fa-google", label: "Google", tags: ["search", "google"] },
  { iconClass: "fa-brands fa-youtube", label: "YouTube", tags: ["video", "media"] },
  { iconClass: "fa-brands fa-telegram", label: "Telegram", tags: ["chat", "message"] },
  { iconClass: "fa-brands fa-discord", label: "Discord", tags: ["community", "chat"] },
  { iconClass: "fa-brands fa-slack", label: "Slack", tags: ["work", "chat", "team"] },
  { iconClass: "fa-brands fa-github", label: "GitHub", tags: ["code", "repo", "git"] },
  { iconClass: "fa-brands fa-linkedin", label: "LinkedIn", tags: ["network", "career"] },
  { iconClass: "fa-brands fa-x-twitter", label: "X", tags: ["twitter", "social"] },
  { iconClass: "fa-brands fa-reddit", label: "Reddit", tags: ["forum", "social"] },
  { iconClass: "fa-solid fa-envelope", label: "Mail", tags: ["email", "gmail", "inbox"] },
  { iconClass: "fa-solid fa-briefcase", label: "Work", tags: ["office", "business"] },
  { iconClass: "fa-solid fa-cart-shopping", label: "Shopping", tags: ["store", "market"] },
  { iconClass: "fa-solid fa-music", label: "Music", tags: ["audio", "spotify"] },
  { iconClass: "fa-solid fa-cloud", label: "Cloud", tags: ["drive", "storage"] },
  { iconClass: "fa-regular fa-calendar", label: "Calendar", tags: ["schedule", "date"] },
  { iconClass: "fa-solid fa-bookmark", label: "Bookmarks", tags: ["saved", "read later"] },
  { iconClass: "fa-solid fa-comments", label: "Chat", tags: ["message", "community"] },
  { iconClass: "fa-solid fa-newspaper", label: "News", tags: ["articles", "reader"] },
  { iconClass: "fa-solid fa-graduation-cap", label: "Learning", tags: ["education", "course"] },
  { iconClass: "fa-brands fa-google-drive", label: "Drive", tags: ["google drive", "files"] },
  { iconClass: "fa-solid fa-file-lines", label: "Docs", tags: ["documents", "google docs"] },
  { iconClass: "fa-solid fa-table-cells", label: "Sheets", tags: ["spreadsheets", "google sheets"] },
  { iconClass: "fa-solid fa-video", label: "Meet", tags: ["video call", "google meet"] },
  { iconClass: "fa-solid fa-note-sticky", label: "Notes", tags: ["notion", "notes"] },
  { iconClass: "fa-brands fa-facebook-messenger", label: "Messenger", tags: ["facebook", "chat"] },
  { iconClass: "fa-solid fa-robot", label: "AI", tags: ["assistant", "chatgpt"] }
];

const ICON_CATALOG_EXTRA: IconChoice[] = [
  { iconClass: "fa-solid fa-house", label: "Home", tags: ["start", "landing"] },
  { iconClass: "fa-solid fa-building", label: "Building", tags: ["office", "company"] },
  { iconClass: "fa-solid fa-user", label: "User", tags: ["profile", "account"] },
  { iconClass: "fa-solid fa-users", label: "Users", tags: ["team", "people"] },
  { iconClass: "fa-solid fa-user-group", label: "Community", tags: ["group", "members"] },
  { iconClass: "fa-solid fa-inbox", label: "Inbox", tags: ["mail", "messages"] },
  { iconClass: "fa-solid fa-paper-plane", label: "Send", tags: ["message", "mail"] },
  { iconClass: "fa-solid fa-comment-dots", label: "Conversation", tags: ["chat", "discussion"] },
  { iconClass: "fa-solid fa-phone", label: "Phone", tags: ["call", "contact"] },
  { iconClass: "fa-solid fa-clock", label: "Clock", tags: ["time", "timer"] },
  { iconClass: "fa-solid fa-stopwatch", label: "Stopwatch", tags: ["timer", "tracking"] },
  { iconClass: "fa-solid fa-list-check", label: "Tasks", tags: ["todo", "checklist"] },
  { iconClass: "fa-solid fa-check", label: "Check", tags: ["done", "complete"] },
  { iconClass: "fa-solid fa-square-check", label: "Checklist", tags: ["tick", "tasks"] },
  { iconClass: "fa-solid fa-book-open", label: "Reader", tags: ["books", "docs"] },
  { iconClass: "fa-solid fa-folder", label: "Folder", tags: ["directory", "files"] },
  { iconClass: "fa-solid fa-folder-open", label: "Open Folder", tags: ["files", "storage"] },
  { iconClass: "fa-solid fa-cloud-arrow-up", label: "Upload", tags: ["cloud", "sync"] },
  { iconClass: "fa-solid fa-cloud-arrow-down", label: "Download", tags: ["cloud", "sync"] },
  { iconClass: "fa-solid fa-hard-drive", label: "Drive", tags: ["disk", "storage"] },
  { iconClass: "fa-solid fa-database", label: "Database", tags: ["data", "sql"] },
  { iconClass: "fa-solid fa-building-columns", label: "Organization", tags: ["enterprise", "company"] },
  { iconClass: "fa-solid fa-chart-line", label: "Analytics", tags: ["stats", "growth"] },
  { iconClass: "fa-solid fa-chart-pie", label: "Reports", tags: ["dashboard", "metrics"] },
  { iconClass: "fa-solid fa-chart-column", label: "Charts", tags: ["bar", "data"] },
  { iconClass: "fa-solid fa-calculator", label: "Calculator", tags: ["math", "finance"] },
  { iconClass: "fa-solid fa-scale-balanced", label: "Legal", tags: ["law", "policy"] },
  { iconClass: "fa-solid fa-receipt", label: "Billing", tags: ["payments", "invoice"] },
  { iconClass: "fa-solid fa-credit-card", label: "Payments", tags: ["card", "money"] },
  { iconClass: "fa-solid fa-wallet", label: "Wallet", tags: ["finance", "money"] },
  { iconClass: "fa-solid fa-money-bill", label: "Cash", tags: ["finance", "payments"] },
  { iconClass: "fa-solid fa-bag-shopping", label: "Store", tags: ["ecommerce", "shop"] },
  { iconClass: "fa-solid fa-store", label: "Shopfront", tags: ["retail", "commerce"] },
  { iconClass: "fa-solid fa-truck", label: "Delivery", tags: ["shipping", "logistics"] },
  { iconClass: "fa-solid fa-location-dot", label: "Location", tags: ["map", "address"] },
  { iconClass: "fa-solid fa-map", label: "Map", tags: ["navigation", "geo"] },
  { iconClass: "fa-solid fa-earth-americas", label: "Earth", tags: ["global", "world"] },
  { iconClass: "fa-solid fa-route", label: "Route", tags: ["travel", "navigation"] },
  { iconClass: "fa-solid fa-plane", label: "Travel", tags: ["flight", "trip"] },
  { iconClass: "fa-solid fa-car", label: "Car", tags: ["transport", "vehicle"] },
  { iconClass: "fa-solid fa-tv", label: "TV", tags: ["stream", "media"] },
  { iconClass: "fa-solid fa-circle-play", label: "Play", tags: ["video", "media"] },
  { iconClass: "fa-solid fa-podcast", label: "Podcast", tags: ["audio", "shows"] },
  { iconClass: "fa-solid fa-camera", label: "Camera", tags: ["photo", "media"] },
  { iconClass: "fa-solid fa-image", label: "Gallery", tags: ["photo", "images"] },
  { iconClass: "fa-solid fa-palette", label: "Design", tags: ["creative", "art"] },
  { iconClass: "fa-solid fa-pen-ruler", label: "Editor", tags: ["design", "tools"] },
  { iconClass: "fa-solid fa-wand-magic-sparkles", label: "Magic", tags: ["ai", "smart"] },
  { iconClass: "fa-solid fa-brain", label: "Intelligence", tags: ["ai", "thinking"] },
  { iconClass: "fa-solid fa-school", label: "School", tags: ["education", "study"] },
  { iconClass: "fa-solid fa-language", label: "Language", tags: ["translation", "text"] },
  { iconClass: "fa-solid fa-rss", label: "Feed", tags: ["news", "updates"] },
  { iconClass: "fa-solid fa-bullhorn", label: "Announcements", tags: ["broadcast", "alerts"] },
  { iconClass: "fa-solid fa-bell", label: "Notifications", tags: ["alerts", "updates"] },
  { iconClass: "fa-solid fa-shield-halved", label: "Security", tags: ["safe", "privacy"] },
  { iconClass: "fa-solid fa-lock", label: "Lock", tags: ["security", "password"] },
  { iconClass: "fa-solid fa-key", label: "Key", tags: ["auth", "security"] },
  { iconClass: "fa-solid fa-fingerprint", label: "Biometric", tags: ["auth", "identity"] },
  { iconClass: "fa-solid fa-gear", label: "Settings", tags: ["preferences", "config"] },
  { iconClass: "fa-solid fa-sliders", label: "Controls", tags: ["settings", "adjust"] },
  { iconClass: "fa-solid fa-wrench", label: "Tools", tags: ["maintenance", "utility"] },
  { iconClass: "fa-solid fa-screwdriver-wrench", label: "Repair", tags: ["fix", "tools"] },
  { iconClass: "fa-solid fa-terminal", label: "Terminal", tags: ["cli", "shell"] },
  { iconClass: "fa-solid fa-code", label: "Code", tags: ["development", "programming"] },
  { iconClass: "fa-solid fa-code-branch", label: "Git", tags: ["version", "repo"] },
  { iconClass: "fa-solid fa-bug", label: "Debug", tags: ["issue", "testing"] },
  { iconClass: "fa-solid fa-microchip", label: "Hardware", tags: ["tech", "chip"] },
  { iconClass: "fa-solid fa-server", label: "Server", tags: ["backend", "infrastructure"] },
  { iconClass: "fa-solid fa-network-wired", label: "Network", tags: ["internet", "infra"] },
  { iconClass: "fa-solid fa-wifi", label: "WiFi", tags: ["network", "internet"] },
  { iconClass: "fa-solid fa-link", label: "Links", tags: ["url", "share"] },
  { iconClass: "fa-solid fa-magnifying-glass", label: "Search", tags: ["find", "lookup"] },
  { iconClass: "fa-solid fa-filter", label: "Filter", tags: ["sort", "query"] },
  { iconClass: "fa-solid fa-tag", label: "Tag", tags: ["labels", "metadata"] },
  { iconClass: "fa-solid fa-tags", label: "Tags", tags: ["labels", "organize"] },
  { iconClass: "fa-solid fa-star", label: "Favorites", tags: ["starred", "important"] },
  { iconClass: "fa-solid fa-heart", label: "Likes", tags: ["favorite", "social"] },
  { iconClass: "fa-solid fa-flag", label: "Flag", tags: ["mark", "important"] },
  { iconClass: "fa-solid fa-fire", label: "Trending", tags: ["hot", "popular"] },
  { iconClass: "fa-solid fa-seedling", label: "Growth", tags: ["green", "startup"] },
  { iconClass: "fa-solid fa-leaf", label: "Eco", tags: ["nature", "green"] },
  { iconClass: "fa-solid fa-gamepad", label: "Gaming", tags: ["games", "play"] },
  { iconClass: "fa-solid fa-trophy", label: "Achievements", tags: ["awards", "win"] },
  { iconClass: "fa-solid fa-medal", label: "Badge", tags: ["achievement", "rank"] },
  { iconClass: "fa-solid fa-dumbbell", label: "Fitness", tags: ["health", "workout"] },
  { iconClass: "fa-solid fa-stethoscope", label: "Health", tags: ["medical", "care"] },
  { iconClass: "fa-solid fa-pills", label: "Medicine", tags: ["health", "pharma"] },
  { iconClass: "fa-solid fa-paw", label: "Pets", tags: ["animals", "care"] },
  { iconClass: "fa-solid fa-utensils", label: "Food", tags: ["restaurant", "meals"] },
  { iconClass: "fa-solid fa-mug-hot", label: "Cafe", tags: ["coffee", "break"] },
  { iconClass: "fa-solid fa-basketball", label: "Sports", tags: ["games", "activity"] },
  { iconClass: "fa-solid fa-cloud-sun", label: "Weather", tags: ["forecast", "climate"] },
  { iconClass: "fa-solid fa-moon", label: "Night", tags: ["theme", "dark"] },
  { iconClass: "fa-solid fa-sun", label: "Day", tags: ["theme", "light"] },
  { iconClass: "fa-brands fa-chrome", label: "Chrome", tags: ["browser", "google"] },
  { iconClass: "fa-brands fa-firefox-browser", label: "Firefox", tags: ["browser", "mozilla"] },
  { iconClass: "fa-brands fa-edge", label: "Edge", tags: ["browser", "microsoft"] },
  { iconClass: "fa-brands fa-opera", label: "Opera", tags: ["browser"] },
  { iconClass: "fa-brands fa-instagram", label: "Instagram", tags: ["social", "photos"] },
  { iconClass: "fa-brands fa-facebook", label: "Facebook", tags: ["social", "network"] },
  { iconClass: "fa-brands fa-tiktok", label: "TikTok", tags: ["social", "video"] },
  { iconClass: "fa-brands fa-pinterest", label: "Pinterest", tags: ["social", "ideas"] },
  { iconClass: "fa-brands fa-snapchat", label: "Snapchat", tags: ["social", "chat"] },
  { iconClass: "fa-brands fa-microsoft", label: "Microsoft", tags: ["office", "cloud"] },
  { iconClass: "fa-brands fa-windows", label: "Windows", tags: ["os", "microsoft"] },
  { iconClass: "fa-brands fa-apple", label: "Apple", tags: ["mac", "ios"] },
  { iconClass: "fa-brands fa-android", label: "Android", tags: ["mobile", "google"] },
  { iconClass: "fa-brands fa-linux", label: "Linux", tags: ["os", "open source"] },
  { iconClass: "fa-brands fa-ubuntu", label: "Ubuntu", tags: ["linux", "distro"] },
  { iconClass: "fa-brands fa-docker", label: "Docker", tags: ["containers", "devops"] },
  { iconClass: "fa-brands fa-aws", label: "AWS", tags: ["cloud", "infra"] },
  { iconClass: "fa-brands fa-google-pay", label: "Google Pay", tags: ["payments", "finance"] },
  { iconClass: "fa-brands fa-paypal", label: "PayPal", tags: ["payments", "finance"] },
  { iconClass: "fa-brands fa-stripe", label: "Stripe", tags: ["payments", "billing"] },
  { iconClass: "fa-brands fa-shopify", label: "Shopify", tags: ["ecommerce", "store"] },
  { iconClass: "fa-brands fa-trello", label: "Trello", tags: ["kanban", "tasks"] },
  { iconClass: "fa-brands fa-jira", label: "Jira", tags: ["tickets", "agile"] },
  { iconClass: "fa-brands fa-figma", label: "Figma", tags: ["design", "ui"] },
  { iconClass: "fa-brands fa-dribbble", label: "Dribbble", tags: ["design", "portfolio"] },
  { iconClass: "fa-brands fa-behance", label: "Behance", tags: ["design", "portfolio"] },
  { iconClass: "fa-brands fa-medium", label: "Medium", tags: ["blog", "writing"] },
  { iconClass: "fa-brands fa-dev", label: "DEV", tags: ["developer", "articles"] },
  { iconClass: "fa-brands fa-stack-overflow", label: "Stack Overflow", tags: ["code", "questions"] },
  { iconClass: "fa-brands fa-gitlab", label: "GitLab", tags: ["code", "repo", "git"] },
  { iconClass: "fa-brands fa-bitbucket", label: "Bitbucket", tags: ["code", "repo", "git"] },
  { iconClass: "fa-brands fa-npm", label: "npm", tags: ["packages", "javascript"] },
  { iconClass: "fa-brands fa-node-js", label: "Node.js", tags: ["javascript", "runtime"] },
  { iconClass: "fa-brands fa-react", label: "React", tags: ["frontend", "javascript"] },
  { iconClass: "fa-brands fa-vuejs", label: "Vue", tags: ["frontend", "javascript"] },
  { iconClass: "fa-brands fa-angular", label: "Angular", tags: ["frontend", "javascript"] },
  { iconClass: "fa-brands fa-python", label: "Python", tags: ["backend", "language"] },
  { iconClass: "fa-brands fa-java", label: "Java", tags: ["backend", "language"] },
  { iconClass: "fa-brands fa-golang", label: "Go", tags: ["backend", "language"] },
  { iconClass: "fa-brands fa-rust", label: "Rust", tags: ["systems", "language"] },
  { iconClass: "fa-brands fa-php", label: "PHP", tags: ["backend", "language"] }
];

const ALL_ICON_CATALOG: IconChoice[] = [...ICON_CATALOG, ...ICON_CATALOG_EXTRA];

const ICON_CHOICES = ALL_ICON_CATALOG.map((item) => item.iconClass);

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

const ICON_RULES: Array<{ keys: string[]; iconClass: string }> = [
  { keys: ["whatsapp"], iconClass: "fa-brands fa-whatsapp" },
  { keys: ["amazon"], iconClass: "fa-brands fa-amazon" },
  { keys: ["youtube"], iconClass: "fa-brands fa-youtube" },
  { keys: ["telegram"], iconClass: "fa-brands fa-telegram" },
  { keys: ["discord"], iconClass: "fa-brands fa-discord" },
  { keys: ["slack"], iconClass: "fa-brands fa-slack" },
  { keys: ["github"], iconClass: "fa-brands fa-github" },
  { keys: ["linkedin"], iconClass: "fa-brands fa-linkedin" },
  { keys: ["reddit"], iconClass: "fa-brands fa-reddit" },
  { keys: ["gmail", "mail.google"], iconClass: "fa-solid fa-envelope" },
  { keys: ["docs.google", "google docs"], iconClass: "fa-solid fa-file-lines" },
  { keys: ["sheets.google", "google sheets"], iconClass: "fa-solid fa-table-cells" },
  { keys: ["meet.google", "google meet"], iconClass: "fa-solid fa-video" },
  { keys: ["google-drive", "drive.google"], iconClass: "fa-brands fa-google-drive" },
  { keys: ["calendar", "calendar.google"], iconClass: "fa-regular fa-calendar" },
  { keys: ["notion"], iconClass: "fa-solid fa-note-sticky" },
  { keys: ["messenger"], iconClass: "fa-brands fa-facebook-messenger" },
  { keys: ["x.com", "twitter"], iconClass: "fa-brands fa-x-twitter" },
  { keys: ["spotify"], iconClass: "fa-brands fa-spotify" },
  { keys: ["netflix"], iconClass: "fa-solid fa-film" },
  { keys: ["chatgpt", "openai"], iconClass: "fa-solid fa-robot" },
  { keys: ["news"], iconClass: "fa-solid fa-newspaper" },
  { keys: ["shopping", "store"], iconClass: "fa-solid fa-cart-shopping" },
  { keys: ["work"], iconClass: "fa-solid fa-briefcase" }
];

const normalizeText = (value: string): string => value.trim().toLowerCase();

const inferIconClass = (name: string, url: string): string => {
  const normalizedName = normalizeText(name);
  const normalizedUrl = normalizeText(url);
  const haystack = `${normalizedName} ${normalizedUrl}`;

  const matched = ICON_RULES.find((rule) => rule.keys.some((key) => haystack.includes(key)));
  if (matched) {
    return matched.iconClass;
  }

  return "fa-solid fa-globe";
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
  const [newAppIconSearch, setNewAppIconSearch] = useState<string>("");
  const [newAppIconClass, setNewAppIconClass] = useState<string>(ICON_CHOICES[0]);
  const [newAppWorkspaceId, setNewAppWorkspaceId] = useState<string>(DEFAULT_APP_STATE.viewState.activeWorkspaceId);
  const [editAppName, setEditAppName] = useState<string>("");
  const [editAppSubtitle, setEditAppSubtitle] = useState<string>("");
  const [editAppUrl, setEditAppUrl] = useState<string>("");
  const [editAppWorkspaceId, setEditAppWorkspaceId] = useState<string>(DEFAULT_APP_STATE.viewState.activeWorkspaceId);
  const [editAppIconSearch, setEditAppIconSearch] = useState<string>("");
  const [editAppIconClass, setEditAppIconClass] = useState<string>(ICON_CHOICES[0]);
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

  const filteredNewIconChoices = useMemo(() => {
    const search = newAppIconSearch.trim().toLowerCase();
    if (!search) {
      return ALL_ICON_CATALOG;
    }

    return ALL_ICON_CATALOG.filter((item) => {
      const haystack = `${item.label} ${item.tags.join(" ")} ${item.iconClass}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [newAppIconSearch]);

  const filteredEditIconChoices = useMemo(() => {
    const search = editAppIconSearch.trim().toLowerCase();
    if (!search) {
      return ALL_ICON_CATALOG;
    }

    return ALL_ICON_CATALOG.filter((item) => {
      const haystack = `${item.label} ${item.tags.join(" ")} ${item.iconClass}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [editAppIconSearch]);

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
        setApps(
          state.apps.map((item) => ({
            ...item,
            iconClass: item.iconClass?.trim() || inferIconClass(item.name, item.url)
          }))
        );
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
    if (!activeApp) {
      setEditAppName("");
      setEditAppSubtitle("");
      setEditAppUrl("");
      setEditAppWorkspaceId(activeWorkspace);
      setEditAppIconClass(ICON_CHOICES[0]);
      return;
    }

    setEditAppName(activeApp.name);
    setEditAppSubtitle(activeApp.subtitle);
    setEditAppUrl(activeApp.url);
    setEditAppWorkspaceId(activeApp.workspaceId);
    setEditAppIconSearch("");
    setEditAppIconClass(activeApp.iconClass?.trim() || inferIconClass(activeApp.name, activeApp.url));
  }, [activeApp, activeWorkspace]);

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

    return inferIconClass(item.name, item.url);
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

      const resolvedIconClass = newAppIconClass?.trim() || inferIconClass(trimmedName, url.toString());

      const nextApp: AppEntry = {
        id,
        name: trimmedName,
        subtitle: hostLabel,
        url: url.toString(),
        iconClass: resolvedIconClass,
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
      setNewAppIconSearch("");
      setNewAppIconClass(ICON_CHOICES[0]);
      setNewAppWorkspaceId(activeWorkspace);
    } catch {
      return;
    }
  };

  const applyAppEdits = () => {
    if (!activeApp) {
      return;
    }

    const trimmedName = editAppName.trim();
    const trimmedSubtitle = editAppSubtitle.trim();
    const trimmedUrl = editAppUrl.trim();
    const targetWorkspaceId = editAppWorkspaceId || activeApp.workspaceId;

    if (!trimmedName || !trimmedUrl) {
      return;
    }

    let normalizedUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      const parsedUrl = new URL(normalizedUrl);
      const hostLabel = parsedUrl.hostname.replace(/^www\./, "");
      const resolvedIconClass = editAppIconClass?.trim() || inferIconClass(trimmedName, parsedUrl.toString());
      const workspaceLabel =
        workspaces.find((item) => item.id === targetWorkspaceId)?.label === "Personal" ? "Personal" : "Work";

      setApps((prev) =>
        prev.map((item) => {
          if (item.id !== activeApp.id) {
            return item;
          }

          return {
            ...item,
            name: trimmedName,
            subtitle: trimmedSubtitle || hostLabel,
            url: parsedUrl.toString(),
            workspaceId: targetWorkspaceId,
            section: workspaceLabel,
            iconClass: resolvedIconClass
          };
        })
      );

      setActiveWorkspace(targetWorkspaceId);
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
    anchor.download = "neostrid-state.json";
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

    setApps(
      parsed.apps.map((item) => ({
        ...item,
        iconClass: item.iconClass?.trim() || inferIconClass(item.name, item.url)
      }))
    );
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
        <div className="chrome-left">
          <div className="launcher-mark" title="Neostrid">
            <img src={neostridLauncherIcon} alt="Neostrid" />
          </div>
          <div className="address-pill">{activeApp?.url ?? "https://"}</div>
        </div>
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
            className="ghost-button settings-trigger"
            aria-label="Open settings"
            title="Settings"
            onClick={() => setSettingsOpen((prev) => !prev)}
          >
            <i className="fa-solid fa-gear" aria-hidden="true" />
            <span>Settings</span>
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
            <div className="brand">Neostrid</div>
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
                    setNewAppIconSearch("");
                    setNewAppIconClass(ICON_CHOICES[0]);
                  }
                  return next;
                });
              }}
            >
              <i className={`fa-solid ${showAddApp ? "fa-xmark" : "fa-plus"}`} aria-hidden="true" />
              <span>{showAddApp ? "Close" : "Add App"}</span>
            </button>
            <div className="workspace-separator" aria-hidden="true" />
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
                  <input
                    className="add-app-input icon-search-input"
                    placeholder="Search icons"
                    value={newAppIconSearch}
                    onChange={(event) => setNewAppIconSearch(event.target.value)}
                  />
                  <button
                    type="button"
                    className={`icon-choice ${newAppIconClass === inferIconClass(newAppName, newAppUrl) ? "active" : ""}`}
                    title="Auto icon"
                    onClick={() => setNewAppIconClass(inferIconClass(newAppName, newAppUrl))}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                  </button>
                  {filteredNewIconChoices.map((choice) => (
                    <button
                      key={choice.iconClass}
                      type="button"
                      className={`icon-choice ${newAppIconClass === choice.iconClass ? "active" : ""}`}
                      title={choice.label}
                      onClick={() => setNewAppIconClass(choice.iconClass)}
                    >
                      <i className={choice.iconClass} aria-hidden="true" />
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
                <div className="settings-heading">Neostrid Settings</div>

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

                <div className="session-header">Edit Active App</div>
                {activeApp ? (
                  <div className="app-edit-grid">
                    <input
                      className="add-app-input"
                      placeholder="App name"
                      value={editAppName}
                      onChange={(event) => setEditAppName(event.target.value)}
                    />
                    <input
                      className="add-app-input"
                      placeholder="Subtitle"
                      value={editAppSubtitle}
                      onChange={(event) => setEditAppSubtitle(event.target.value)}
                    />
                    <input
                      className="add-app-input"
                      placeholder="https://example.com"
                      value={editAppUrl}
                      onChange={(event) => setEditAppUrl(event.target.value)}
                    />
                    <select
                      className="add-app-input"
                      value={editAppWorkspaceId}
                      onChange={(event) => setEditAppWorkspaceId(event.target.value)}
                    >
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.label}
                        </option>
                      ))}
                    </select>
                    <div className="icon-picker" aria-label="Edit app icon picker">
                      <input
                        className="add-app-input icon-search-input"
                        placeholder="Search icons"
                        value={editAppIconSearch}
                        onChange={(event) => setEditAppIconSearch(event.target.value)}
                      />
                      <button
                        type="button"
                        className={`icon-choice ${editAppIconClass === inferIconClass(editAppName, editAppUrl) ? "active" : ""}`}
                        title="Auto icon"
                        onClick={() => setEditAppIconClass(inferIconClass(editAppName, editAppUrl))}
                      >
                        <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                      </button>
                      {filteredEditIconChoices.map((choice) => (
                        <button
                          key={`edit-${choice.iconClass}`}
                          type="button"
                          className={`icon-choice ${editAppIconClass === choice.iconClass ? "active" : ""}`}
                          title={choice.label}
                          onClick={() => setEditAppIconClass(choice.iconClass)}
                        >
                          <i className={choice.iconClass} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                    <button type="button" className="add-app-submit" onClick={applyAppEdits}>
                      Save Changes
                    </button>
                  </div>
                ) : (
                  <div className="empty-state">Select an app to edit.</div>
                )}

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

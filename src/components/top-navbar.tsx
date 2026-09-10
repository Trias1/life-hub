"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  applyCustomizePreferences,
  readCustomizePreferences,
} from "@/lib/customize";
import {
  Bell,
  CircleHelp,
  CircleUserRound,
  Menu,
  Moon,
  Monitor,
  Plus,
  Search,
  Settings,
  Sun,
  Upload,
  X,
} from "lucide-react";

type SignOutAction = () => Promise<void>;
type MarkAllReadAction = () => Promise<void>;
type ThemeMode = "light" | "dark" | "system";
type NotificationItem = {
  id: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};
type NavbarProps = {
  user: { email: string; displayName: string; avatarUrl: string | null };
  workspace: { name: string };
  notifications: NotificationItem[];
  signOut: SignOutAction;
  markAllRead: MarkAllReadAction;
  onOpenMobile: () => void;
};
type WorkspaceSearchResult = {
  id: string;
  type: "note" | "task" | "file" | "bookmark";
  title: string;
  subtitle: string;
  href: string;
};

const searchItems = [
  { label: "Dashboard", href: "/dashboard", group: "Workspace" },
  { label: "Notes", href: "/notes", group: "Workspace" },
  { label: "Tasks", href: "/tasks", group: "Workspace" },
  { label: "Calendar", href: "/calendar", group: "Workspace" },
  { label: "Files", href: "/files", group: "Workspace" },
  { label: "Bookmarks", href: "/bookmarks", group: "Workspace" },
  { label: "Notifications", href: "/notifications", group: "Workspace" },
  { label: "Profile", href: "/profile", group: "People" },
  { label: "Settings", href: "/settings", group: "Commands" },
];

function pageMeta(pathname: string) {
  if (pathname.startsWith("/dashboard"))
    return {
      title: "Dashboard",
      description: "Dashboard working context.",
      action: "New Note",
      href: "/dashboard",
    };
  if (pathname.startsWith("/notes"))
    return {
      title: "Notes",
      description: "Capture ideas and working context.",
      action: "New Note",
      href: "/notes",
    };
  if (pathname.startsWith("/tasks"))
    return {
      title: "Tasks",
      description: "Manage your next actions.",
      action: "Create Task",
      href: "/tasks",
    };
  if (pathname.startsWith("/calendar"))
    return {
      title: "Calendar",
      description: "Give important work a place in time.",
      action: "Create Event",
      href: "/calendar",
    };
  if (pathname.startsWith("/files"))
    return {
      title: "Files",
      description: "Private workspace storage.",
      action: "Upload",
      href: "/files",
    };
  if (pathname.startsWith("/bookmarks"))
    return {
      title: "Bookmarks",
      description: "Useful links, kept close.",
      action: "Add Bookmark",
      href: "/bookmarks",
    };
  if (pathname.startsWith("/notifications"))
    return {
      title: "Notifications",
      description: "Updates from your workspace.",
      action: "",
      href: "",
    };
  if (pathname.startsWith("/profile"))
    return {
      title: "Profile",
      description: "Your Sanctum Cove identity.",
      action: "",
      href: "",
    };
  if (pathname.startsWith("/settings"))
    return {
      title: "Settings",
      description: "Workspace preferences.",
      action: "",
      href: "",
    };
  if (pathname.startsWith("/customize"))
    return {
      title: "Customize",
      description: "Tune your workspace experience.",
      action: "",
      href: "",
    };
  return {
    title: "Dashboard",
    description: "Your focused workspace overview.",
    action: "Quick Action",
    href: "/notes",
  };
}

function applyTheme(mode: ThemeMode) {
  const resolved =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  applyCustomizePreferences({ ...readCustomizePreferences(), theme: resolved });
  window.localStorage.setItem("lifehub:theme-preference", mode);
}

export function TopNavbar({
  user,
  workspace,
  notifications,
  signOut,
  markAllRead,
  onOpenMobile,
}: NavbarProps) {
  const pathname = usePathname();
  const meta = pageMeta(pathname);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResult[]>(
    [],
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const unread = notifications.filter((item) => !item.is_read).length;
  const normalizedQuery = query.trim();
  useEffect(() => {
    const saved =
      (window.localStorage.getItem(
        "lifehub:theme-preference",
      ) as ThemeMode | null) ?? "dark";
    setTheme(saved);
    applyTheme(saved);
    const onSearch = () => {
      setSearchOpen(true);
      setQuery("");
    };
    const onTheme = () => {
      const next: ThemeMode =
        theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
      setTheme(next);
      applyTheme(next);
    };
    window.addEventListener("lifehub:open-global-search", onSearch);
    window.addEventListener("lifehub:toggle-theme", onTheme);
    return () => {
      window.removeEventListener("lifehub:open-global-search", onSearch);
      window.removeEventListener("lifehub:toggle-theme", onTheme);
    };
  }, [theme]);
  useEffect(() => {
    const syncTheme = () =>
      setTheme(
        (window.localStorage.getItem(
          "lifehub:theme-preference",
        ) as ThemeMode | null) ?? "dark",
      );
    window.addEventListener("lifehub:theme-change", syncTheme);
    return () => window.removeEventListener("lifehub:theme-change", syncTheme);
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setHelpOpen(false);
        setNotificationOpen(false);
        setProfileOpen(false);
        setThemeOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    if (!searchOpen || normalizedQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(false);
      return;
    }
    setSearchResults([]);
    setSearchLoading(true);
    setSearchError(false);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search failed");
        const payload = (await response.json()) as {
          results?: WorkspaceSearchResult[];
        };
        setSearchResults(payload.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSearchResults([]);
          setSearchError(true);
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, searchOpen]);
  const iconForAction =
    meta.title === "Files" ? (
      <Upload size={17} />
    ) : meta.title === "Calendar" ? (
      <Plus size={17} />
    ) : meta.title === "Tasks" ? (
      <Plus size={17} />
    ) : meta.title === "Bookmarks" ? (
      <Plus size={17} />
    ) : (
      <Plus size={17} />
    );
  return (
    <header className="top-navbar sticky top-0 z-50 flex h-[72px] items-center gap-4 border-b px-4 backdrop-blur-lg sm:px-6">
      {/* <button
        type="button"
        onClick={onOpenMobile}
        className="button-secondary min-h-0 shrink-0 p-2 md:hidden"
        aria-label="Open navigation"
      >
        <Menu size={1} />
      </button> */}
      <div className="flex min-w-0 items-center gap-3">
        {meta.title !== "Dashboard" && (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="hidden text-xs font-medium text-zinc-500 hover:text-zinc-900 sm:inline"
              >
                Dashboard
              </Link>
              <span className="hidden text-zinc-300 sm:inline">/</span>
              <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">
                {meta.title}
              </h1>
            </div>
            <p className="hidden truncate text-xs text-zinc-500 md:block">
              {meta.description}
            </p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="top-search group mx-auto hidden h-11 w-full max-w-[420px] items-center gap-3 rounded-xl border px-3 text-left text-sm text-zinc-500 transition hover:border-[#111111] md:flex"
        aria-label="Open global search"
      >
        <Search size={17} className="group-hover:text-[#111111]" />
        <span className="flex-1">Search workspace...</span>
        <kbd className="rounded border px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="button-secondary min-h-0 p-2 md:hidden"
          aria-label="Search"
        >
          <Search size={18} />
        </button>
        {meta.action && (
          <Link
            href={meta.href}
            className="hidden h-11 items-center gap-2 rounded-xl bg-[#111111] px-3.5 text-sm font-semibold text-white shadow-lg shadow-[#111111]/20 transition hover:bg-[#000000] sm:inline-flex"
          >
            {iconForAction}
            {meta.action}
          </Link>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationOpen(!notificationOpen);
              setHelpOpen(false);
              setProfileOpen(false);
              setThemeOpen(false);
            }}
            className="button-secondary relative min-h-0 p-2"
            aria-label="Notifications"
            aria-expanded={notificationOpen}
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {notificationOpen && (
            <div className="top-dropdown right-0">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="text-sm font-semibold">Notifications</p>
                {unread > 0 && (
                  <form action={markAllRead}>
                    <button className="text-xs font-semibold text-[#111111]">
                      Mark all read
                    </button>
                  </form>
                )}
              </div>
              {notifications.length ? (
                notifications.slice(0, 8).map((item) => (
                  <Link
                    key={item.id}
                    href="/notifications"
                    className={
                      "block border-b px-4 py-3 text-sm hover:bg-zinc-50 " +
                      (!item.is_read ? "bg-zinc-100/50" : "")
                    }
                  >
                    <p className="font-medium">{item.message}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.type} · {new Date(item.created_at).toLocaleString()}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">
                  No notifications yet.
                </p>
              )}
              <Link
                href="/notifications"
                className="block px-4 py-3 text-center text-xs font-semibold text-[#111111]"
              >
                Open notifications
              </Link>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setHelpOpen(!helpOpen);
              setNotificationOpen(false);
              setProfileOpen(false);
              setThemeOpen(false);
            }}
            className="button-secondary hidden min-h-0 p-2 sm:inline-flex"
            aria-label="Help"
            aria-expanded={helpOpen}
          >
            <CircleHelp size={18} />
          </button>
          {helpOpen && (
            <div className="top-dropdown right-0">
              <p className="border-b px-4 py-3 text-sm font-semibold">Help</p>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new KeyboardEvent("keydown", { key: "?" }),
                  )
                }
                className="top-dropdown-item"
              >
                Keyboard Shortcuts
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setThemeOpen(!themeOpen);
              setNotificationOpen(false);
              setHelpOpen(false);
              setProfileOpen(false);
            }}
            className="button-secondary hidden min-h-0 p-2 sm:inline-flex"
            aria-label="Theme"
            aria-expanded={themeOpen}
          >
            {theme === "dark" ? (
              <Moon size={18} />
            ) : theme === "light" ? (
              <Sun size={18} />
            ) : (
              <Monitor size={18} />
            )}
          </button>
          {themeOpen && (
            <div className="top-dropdown right-0">
              <p className="border-b px-4 py-3 text-sm font-semibold">Theme</p>
              {(
                [
                  ["light", "Light", Sun],
                  ["dark", "Dark", Moon],
                  ["system", "System", Monitor],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTheme(value);
                    applyTheme(value);
                    setThemeOpen(false);
                  }}
                  className="top-dropdown-item"
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Link
          href="/settings"
          className="button-secondary hidden min-h-0 p-2 sm:inline-flex"
          aria-label="Settings"
        >
          <Settings size={18} />
        </Link>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotificationOpen(false);
              setHelpOpen(false);
              setThemeOpen(false);
            }}
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#111111] text-sm font-bold text-white"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
          >
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                width={44}
                height={44}
                unoptimized
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              (user.displayName || user.email).slice(0, 1).toUpperCase()
            )}
          </button>
          {profileOpen && (
            <div className="top-dropdown right-0">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">{user.displayName}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {user.email} · {workspace.name}
                </p>
              </div>
              <Link href="/profile" className="top-dropdown-item">
                <CircleUserRound size={16} />
                Profile
              </Link>
              <Link href="/settings" className="top-dropdown-item">
                <Settings size={16} />
                Workspace
              </Link>
              <Link href="/customize" className="top-dropdown-item">
                <Sun size={16} />
                Appearance
              </Link>
              <form action={signOut} className="border-t">
                <button className="top-dropdown-item w-full text-red-600">
                  Logout
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      {searchOpen && (
        <div
          className="fixed inset-0 z-[60] bg-zinc-950/40 p-4 sm:p-10"
          role="presentation"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="mx-auto mt-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-search-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
              <Search size={19} className="text-[var(--muted)]" />
              <label
                id="global-search-title"
                className="sr-only"
                htmlFor="global-search"
              >
                Search everything
              </label>
              <input
                id="global-search"
                autoFocus
                maxLength={80}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-14 flex-1 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                placeholder="Search notes, files, tasks, bookmarks..."
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="button-quiet min-h-0 p-2"
                aria-label="Close search"
              >
                <X size={18} />
              </button>
            </div>
            <div
              className="max-h-[60vh] overflow-y-auto p-2"
              aria-live="polite"
            >
              {!normalizedQuery ? (
                searchItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    <span>{item.label}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {item.group}
                    </span>
                  </Link>
                ))
              ) : normalizedQuery.length < 2 ? (
                <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                  Type at least 2 characters.
                </p>
              ) : searchLoading ? (
                <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                  Searching workspace...
                </p>
              ) : searchError ? (
                <p className="px-3 py-8 text-center text-sm text-red-600">
                  Could not search workspace.
                </p>
              ) : searchResults.length ? (
                searchResults.map((item) => (
                  <Link
                    key={`${item.type}:${item.id}`}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    className="block rounded-xl px-3 py-3 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{item.title}</span>
                      <span className="shrink-0 text-xs capitalize text-[var(--muted)]">
                        {item.type}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--muted)]">
                      {item.subtitle}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                  No workspace results found.
                </p>
              )}
            </div>
            <div className="border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">
              Search current workspace - Press Esc to close
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

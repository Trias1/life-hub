"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bookmark,
  CalendarDays,
  Check,
  ClipboardList,
  Folder,
  LayoutDashboard,
  MoreHorizontal,
  Notebook,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type SignOutAction = () => Promise<void>;
type CreateSpaceAction = (formData: FormData) => Promise<void>;
type CreateWorkspaceAction = (formData: FormData) => Promise<void>;
type SpaceAction = (formData: FormData) => Promise<void>;
type SelectWorkspaceAction = (formData: FormData) => Promise<void>;
type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};
type SidebarProps = {
  collapsed: boolean;
  setCollapsed: (value: boolean | ((value: boolean) => boolean)) => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  };
  workspace: { id: string; name: string; plan: string; isOwner: boolean };
  workspaces: Array<{ id: string; name: string; owner_id: string }>;
  counts: {
    tasks: number;
    notifications: number;
    activity: number;
    storageBytes: number;
    storageLimitBytes: number | null;
  };
  spaces: Array<{ id: string; name: string; color: string }>;
  createSpace: CreateSpaceAction;
  createWorkspace: CreateWorkspaceAction;
  updateSpace: SpaceAction;
  archiveSpace: SpaceAction;
  deleteSpace: SpaceAction;
  selectWorkspace: SelectWorkspaceAction;
  signOut: SignOutAction;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + " GB";
}

function Badge({ value }: { value?: number }) {
  return value ? (
    <span className="ml-auto rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--on-accent)]">
      {value > 99 ? "99+" : value}
    </span>
  ) : null;
}

function dotColor(color: string) {
  return color === "blue"
    ? "bg-blue-400"
    : color === "emerald"
      ? "bg-emerald-400"
      : color === "rose"
        ? "bg-rose-400"
        : "bg-[var(--accent)]";
}

export function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  user,
  workspace,
  workspaces,
  counts,
  spaces,
  createSpace,
  createWorkspace,
  updateSpace,
  archiveSpace,
  deleteSpace,
  selectWorkspace,
  signOut,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [spaceModal, setSpaceModal] = useState(false);
  const [workspaceModal, setWorkspaceModal] = useState(false);
  const [spaceMenuId, setSpaceMenuId] = useState<string | null>(null);
  const [editingSpace, setEditingSpace] = useState<{
    id: string;
    name: string;
    color: string;
  } | null>(null);

  const closeAll = () => {
    setProfileOpen(false);
    setMobileOpen(false);
    setSpaceMenuId(null);
  };

  const toggleCollapsed = () =>
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("lifehub:sidebar-collapsed", String(next));
      return next;
    });

  const navigation: NavItem[] = useMemo(
    () => [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Notes", href: "/notes", icon: Notebook },
      {
        label: "Tasks",
        href: "/tasks",
        icon: ClipboardList,
        badge: counts.tasks,
      },
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
      { label: "Files", href: "/files", icon: Folder },
      { label: "Bookmarks", href: "/bookmarks", icon: Bookmark },
      { label: "Team", href: "/team", icon: Users },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
    [counts.tasks],
  );

  const filteredNavigation = navigation.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()),
  );

  const navigate = (href: string) => {
    setMobileOpen(false);
    router.push(href);
  };

  useEffect(() => {
    const openSearch = () => {
      setCollapsed(false);
      setSearchOpen(true);
      setQuery("");
    };
    const go = (event: Event) => {
      const route = (event as CustomEvent<string>).detail;
      if (route) router.push(route);
    };
    window.addEventListener("lifehub:open-search", openSearch);
    window.addEventListener("lifehub:go", go);
    return () => {
      window.removeEventListener("lifehub:open-search", openSearch);
      window.removeEventListener("lifehub:go", go);
    };
  }, [router, setCollapsed]);

  return (
    <>
      <aside
        className={
          "lifehub-sidebar fixed inset-y-0 left-0 z-40 flex w-[min(280px,75vw)] flex-col md:w-[var(--sidebar-width)] md:max-w-none border-r border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] shadow-2xl transition-transform duration-[250ms] md:translate-x-0 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full")
        }
        aria-label="Sanctum Cove sidebar"
      >
        {/* Header */}
        <div className="flex h-[72px] items-center justify-between border-b border-[var(--line)] px-4">
          <Link
            href="/dashboard"
            onClick={(e) => {
              e.preventDefault();
              toggleCollapsed();
            }}
            className="flex min-w-0 items-center gap-3"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="brand-mark shrink-0">SC</span>
            {!collapsed && (
              <span className="truncate text-[18px] font-semibold tracking-tight text-[var(--foreground)]">
                Sanctum Cove
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] md:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 pb-1 pt-3">
            <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("lifehub:open-search"))}
            className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          >
            <Search size={15} />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {/* Nav */}
          <nav aria-label="Main navigation" className="mt-1 space-y-1">
            {filteredNavigation.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition duration-150 " +
                    (collapsed ? "justify-center " : "") +
                    (active
                      ? "bg-[var(--accent)] text-[var(--on-accent)] shadow-lg"
                      : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]")
                  }
                >
                  {active && (
                    <span className="absolute left-0 h-6 w-1 rounded-r-full bg-[var(--on-accent)]" />
                  )}
                  <Icon
                    size={18}
                    strokeWidth={active ? 2.4 : 2}
                    className={active ? "text-[var(--on-accent)]" : "text-[var(--muted)] group-hover:text-[var(--foreground)]"}
                  />
                  {!collapsed && (
                    <>
                      <span>{item.label}</span>
                      <Badge value={item.badge} />
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          {!collapsed && (
            <>
              <div className="my-6 border-t border-[var(--line)]" />
              {/* Storage */}
              <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[var(--foreground)]">Storage</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      {formatBytes(counts.storageBytes)} used
                    </p>
                  </div>
                  <Upload size={16} className="text-[var(--muted)]" />
                </div>
                <p className="mt-2 text-[11px] text-[var(--muted)]">
                  {counts.storageLimitBytes
                    ? formatBytes(counts.storageLimitBytes) + " Drive limit"
                    : "Drive quota unavailable"}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{
                      width: counts.storageLimitBytes
                        ? Math.min(100, (counts.storageBytes / counts.storageLimitBytes) * 100) + "%"
                        : "0%",
                    }}
                  />
                </div>
                <Link
                  href="/files"
                  className="mt-3 block text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  Manage files
                </Link>
              </section>
            </>
          )}
        </div>

        {/* Profile footer */}
        <div className="relative border-t border-[var(--line)] p-3">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className={
              "flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-[var(--surface-muted)] " +
              (collapsed ? "justify-center" : "")
            }
            aria-expanded={profileOpen}
            aria-label="Open profile menu"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--on-accent)]">
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt=""
                  width={36}
                  height={36}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                (user.displayName || user.email).slice(0, 1).toUpperCase()
              )}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                    {user.displayName}
                  </span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {user.email}
                  </span>
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </>
            )}
          </button>

          {profileOpen && (
            <div
              className={
                "absolute bottom-16 z-30 w-56 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-2 shadow-xl " +
                (collapsed ? "left-3" : "left-3 right-3")
              }
            >
              <Link href="/profile" className="sidebar-menu-item" onClick={closeAll}>My Profile</Link>
              <Link href="/settings" className="sidebar-menu-item" onClick={closeAll}>Settings</Link>
              <Link href="/customize" className="sidebar-menu-item" onClick={closeAll}>Appearance</Link>
              <button
                type="button"
                onClick={() => { closeAll(); window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" })) }}
                className="sidebar-menu-item"
              >
                Keyboard Shortcuts
              </button>
              <form action={signOut} className="mt-1 border-t border-[var(--line)] pt-1">
                <button className="sidebar-menu-item w-full text-red-400">
                  Logout
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Account & workspace panel */}
        {!collapsed && (
          <div className="space-y-0.5 border-t border-[var(--line)] px-3 py-2">
            <p className="truncate px-2 py-1 text-[11px] text-[var(--muted)]">{user.email}</p>
            {workspaces.map((ws) => (
              <form key={ws.id} action={selectWorkspace}>
                <input type="hidden" name="workspaceId" value={ws.id} />
                <button className={"flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition " + (ws.id === workspace.id ? "bg-[var(--surface-muted)] font-semibold text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]")}>
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-[var(--accent)] text-[9px] font-bold text-[var(--on-accent)]">{ws.name.slice(0, 1).toUpperCase()}</span>
                  <span className="flex-1 truncate text-left">{ws.name}</span>
                  {ws.id === workspace.id && <Check size={11} className="shrink-0 text-[var(--foreground)]" />}
                </button>
              </form>
            ))}
            <button type="button" onClick={() => { closeAll(); setWorkspaceModal(true); }} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"><Plus size={13} /><span>New workspace</span></button>

          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (<button type="button" className="fixed inset-0 z-30 bg-black/60 md:hidden backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="Close sidebar overlay" />)}

      {/* Edit space modal */}
      {editingSpace && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation" onClick={() => setEditingSpace(null)}>
          <form action={updateSpace} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--foreground)]" role="dialog" aria-modal="true" aria-labelledby="edit-space-title">
            <div className="flex items-center justify-between">
              <h2 id="edit-space-title" className="text-lg font-semibold">Rename Space</h2>
              <button type="button" onClick={() => setEditingSpace(null)} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]" aria-label="Close rename space"><X size={18} /></button>
            </div>
            <input type="hidden" name="id" value={editingSpace.id} />
            <label className="mt-5 block text-sm font-medium">
              Name
              <input
                required
                name="name"
                defaultValue={editingSpace.name}
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <input type="hidden" name="color" value={editingSpace.color} />
            <input type="hidden" name="icon" value="folder" />
            <input type="hidden" name="description" value="" />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSpace(null)}
                className="rounded-xl px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)]"
              >
                Cancel
              </button>
              <button className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-hover)]">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create space modal */}
      {spaceModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setSpaceModal(false)}
        >
          <form
            action={createSpace}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--foreground)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="space-title"
          >
            <div className="flex items-center justify-between">
              <h2 id="space-title" className="text-lg font-semibold">Create Space</h2>
              <button
                type="button"
                onClick={() => setSpaceModal(false)}
                className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                aria-label="Close create space"
              >
                <X size={18} />
              </button>
            </div>
            <label className="mt-5 block text-sm font-medium">
              Name
              <input
                required
                name="name"
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                placeholder="Projects"
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Color
                <select
                  name="color"
                  defaultValue="indigo"
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
                >
                  <option value="indigo">Neutral</option>
                  <option value="blue">Blue</option>
                  <option value="emerald">Emerald</option>
                  <option value="rose">Rose</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Icon
                <select
                  name="icon"
                  defaultValue="folder"
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
                >
                  <option value="folder">Folder</option>
                  <option value="star">Star</option>
                  <option value="sparkles">Sparkles</option>
                </select>
              </label>
            </div>
            <label className="mt-4 block text-sm font-medium">
              Description
              <textarea
                name="description"
                className="mt-2 min-h-20 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                placeholder="What belongs here?"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSpaceModal(false)}
                className="rounded-xl px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)]"
              >
                Cancel
              </button>
              <button className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-hover)]">
                Create Space
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Create workspace modal */}
      {workspaceModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setWorkspaceModal(false)}
        >
          <form
            action={createWorkspace}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--foreground)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-modal-title"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-[var(--muted)]">Step 1 of 1</p>
                <h2 id="workspace-modal-title" className="mt-1 text-2xl font-bold">Create your workspace</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Your workspace keeps data and collaboration together.</p>
              </div>
              <button type="button" onClick={() => setWorkspaceModal(false)} className="self-start rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <label className="mt-6 block text-sm font-medium">
              Workspace name
              <input required name="name" defaultValue="My workspace" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] outline-none focus:border-[var(--accent)]" />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Workspace slug
              <input required name="slug" defaultValue="my-workspace" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] outline-none focus:border-[var(--accent)]" />
            </label>
            <button type="submit" className="mt-6 w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-hover)]">
              Create workspace
            </button>
          </form>
        </div>
      )}

    </>
  );
}
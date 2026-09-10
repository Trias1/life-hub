"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

type FormAction = (formData: FormData) => Promise<void>;
type Activity = { label: string; detail: string; time: string };
type Props = {
  email: string;
  profile: {
    display_name: string | null;
    username: string | null;
    bio: string;
    avatar_url: string | null;
  } | null;
  avatarUrl: string | null;
  activity: Activity[];
  updateProfile: FormAction;
  uploadProfileAvatar: FormAction;
  googleConnected: boolean;
  googleStatus: string | null;
  disconnectGoogle: () => Promise<void>;
};
type Tab = "overview" | "activity" | "security" | "sessions" | "accounts";

export function ProfileStudio({
  email,
  profile,
  avatarUrl,
  activity,
  updateProfile,
  uploadProfileAvatar,
  googleConnected,
  googleStatus,
  disconnectGoogle,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const name = profile?.display_name || email.split("@")[0] || "Sanctum Cove user";
  const completion =
    [
      profile?.display_name,
      profile?.username,
      profile?.bio,
      profile?.avatar_url,
    ].filter(Boolean).length * 25;
  const tabs: Array<[Tab, string]> = [
    ["overview", "Overview"],
    ["activity", "Activity"],
    ["security", "Security"],
    ["sessions", "Sessions"],
    ["accounts", "Connected Accounts"],
  ];

  const overview = (
    <div className="space-y-6">
      <form
        action={uploadProfileAvatar}
        className="flex flex-col gap-3 rounded-2xl bg-[var(--surface-muted)] p-4 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="returnPath" value="/profile" />
        <label className="field-label flex-1">
          Profile photo
          <input
            required
            name="avatar"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="field-control mt-1 text-sm"
          />
        </label>
        <button className="button-secondary">Upload photo</button>
        <p className="text-xs text-zinc-500">PNG, JPEG, or WebP ? max 2 MB</p>
      </form>
      <form action={updateProfile} className="grid gap-5 sm:grid-cols-2">
        <input type="hidden" name="returnPath" value="/profile" />
        <label className="field-label">
          Full name
          <input
            required
            name="displayName"
            defaultValue={profile?.display_name ?? ""}
            className="field-control"
          />
        </label>
        <label className="field-label">
          Username
          <input
            name="username"
            defaultValue={profile?.username ?? ""}
            placeholder="your_username"
            className="field-control"
          />
        </label>
        <label className="field-label sm:col-span-2">
          Email
          <input readOnly value={email} className="field-control opacity-70" />
        </label>
        <label className="field-label sm:col-span-2">
          Bio
          <textarea
            name="bio"
            defaultValue={profile?.bio ?? ""}
            maxLength={400}
            className="field-control min-h-28 resize-y"
          />
        </label>
        <div className="sm:col-span-2">
          <button className="button-primary">Save profile</button>
        </div>
      </form>
    </div>
  );
  const activityTab = (
    <div className="space-y-3">
      {activity.length ? (
        activity.map((item, index) => (
          <article key={index} className="profile-activity-row">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-muted)] text-xs font-semibold">
              {item.label.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-sm text-zinc-500">{item.detail}</p>
            </div>
            <time className="text-xs text-zinc-500">{item.time}</time>
          </article>
        ))
      ) : (
        <p className="text-sm text-zinc-500">
          Your notes, tasks, files, and workspace activity will appear here.
        </p>
      )}
    </div>
  );
  const security = (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-zinc-500">
        Keep account recovery and access controls in one place. Two-factor
        authentication will be available when configured.
      </p>
      <Link href="/security" className="button-primary w-fit">
        Open Security Center
      </Link>
    </div>
  );
  const sessions = (
    <div className="space-y-4">
      <article className="profile-session">
        <div>
          <p className="font-semibold">Current browser</p>
          <p className="mt-1 text-sm text-zinc-500">
            This signed-in session ? {email}
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600">
          Current
        </span>
      </article>
      <p className="text-sm text-zinc-500">
        Other devices will appear here when session management is configured.
      </p>
    </div>
  );
  const accounts = (
    <div className="grid gap-3 sm:grid-cols-2">
      <article className="profile-provider">
        <div>
          <p className="font-semibold">Google</p>
          <p className="mt-1 text-sm text-zinc-500">{googleConnected ? "Connected" : "Not connected"}</p>
        </div>
        {googleConnected ? (
          <form action={disconnectGoogle}>
            <button className="button-secondary min-h-0 px-3 py-2 text-xs">Disconnect</button>
          </form>
        ) : (
          <a href="/api/auth/google/account/login" className="button-primary min-h-0 px-3 py-2 text-xs">Connect Google</a>
        )}
      </article>
      {["GitHub", "Discord", "Microsoft"].map((provider) => (
        <article key={provider} className="profile-provider">
          <div>
            <p className="font-semibold">{provider}</p>
            <p className="mt-1 text-sm text-zinc-500">Coming soon</p>
          </div>
          <span className="rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">Coming soon</span>
        </article>
      ))}
      {googleStatus === "connected" && <p className="sm:col-span-2 text-sm text-emerald-600">Google account connected successfully.</p>}
      {googleStatus === "disconnected" && <p className="sm:col-span-2 text-sm text-zinc-500">Google account disconnected.</p>}
    </div>
  );
  const content =
    tab === "overview"
      ? overview
      : tab === "activity"
        ? activityTab
        : tab === "security"
          ? security
          : tab === "sessions"
            ? sessions
            : accounts;
  const avatar = avatarUrl ? (
    <Image
      src={avatarUrl}
      alt={name + " profile photo"}
      width={160}
      height={160}
      unoptimized
      className="h-full w-full rounded-full object-cover"
    />
  ) : (
    name.slice(0, 1).toUpperCase()
  );

  return (
    <div className="page-container">
      <section className="profile-hero">
        <div className="profile-banner" />
        <div className="relative -mt-10 flex flex-col gap-5 px-5 pb-6 sm:flex-row sm:items-end">
          <div
            className={
              avatarUrl
                ? "profile-avatar profile-avatar-image"
                : "profile-avatar"
            }
            aria-label={avatarUrl ? name + " profile photo" : undefined}
          >
            {avatar}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-semibold tracking-tight">{name}</p>
            <p className="mt-1 text-sm text-zinc-500">
              @{profile?.username || "username"} ? Sanctum Cove workspace
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              {profile?.bio ||
                "Add a short bio to make your workspace identity feel complete."}
            </p>
          </div>
          <div className="w-full sm:w-40">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Profile</span>
              <span>{completion}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: completion + "%" }}
              />
            </div>
          </div>
        </div>
      </section>
      <nav className="profile-tabs" aria-label="Profile sections">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key ? "profile-tab profile-tab-active" : "profile-tab"
            }
          >
            {label}
          </button>
        ))}
      </nav>
      <section className="profile-content">{content}</section>
    </div>
  );
}

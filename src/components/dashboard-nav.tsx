"use client";
import { usePathname } from "next/navigation";

const navigation = [
  ["Overview", "/dashboard"],
  ["Notes", "/notes"],
  ["Tasks", "/tasks"],
  ["Calendar", "/calendar"],
  ["Bookmarks", "/bookmarks"],
  ["Files", "/files"],
  ["Notifications", "/notifications"],
  ["Activity", "/activity"],
  ["Team", "/team"],
  ["Profile", "/profile"],
  ["Customize", "/customize"],
  ["Settings", "/settings"],
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace navigation" className="space-y-1 text-sm">
      {navigation.map(([label, href]) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <a
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              "flex items-center gap-3 rounded-xl px-3 py-2.5 transition " +
              (active
                ? "bg-zinc-900 font-semibold text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950")
            }
          >
            <span
              aria-hidden="true"
              className={
                "h-1.5 w-1.5 rounded-full " +
                (active ? "bg-zinc-500" : "bg-zinc-300")
              }
            />
            {label}
          </a>
        );
      })}
    </nav>
  );
}

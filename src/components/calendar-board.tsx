"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Plus, Repeat } from "lucide-react"
import { addDaysToKey, addMonthsToKey, colorLabel, colorTone, dayKey, daysInMonthOfKey, formatKeyLong, formatKeyMonth, formatKeyShort, formatTime, repeatLabel, weekdayOfKey } from "@/components/calendar/calendar-format"

export type CalendarView = "agenda" | "month" | "week" | "day"
export type BoardEvent = { id: string; sourceId: string; title: string; startsAt: string; endsAt: string; color: string; recurrence: string | null }
export type BoardGoogleEvent = { id: string; title: string; startsAt: string; endsAt: string; htmlLink: string | null }
type Props = { events: BoardEvent[]; googleEvents: BoardGoogleEvent[]; todayKey: string; initialView: CalendarView }
type Item = { key: string; title: string; startsAt: string; endsAt: string; day: string; href: string; google: boolean; color: string; recurrence: string | null }

const views: Array<[CalendarView, string]> = [["agenda", "Agenda"], ["month", "Month"], ["week", "Week"], ["day", "Day"]]
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function groupByDay(items: Item[]) {
  const groups = new Map<string, Item[]>()
  for (const item of items) groups.set(item.day, [...(groups.get(item.day) ?? []), item])
  return Array.from(groups.entries())
}

function EventTitle({ item, className }: { item: Item; className: string }) {
  return item.google
    ? <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>{item.title}</a>
    : <Link href={item.href} className={className}>{item.title}</Link>
}

// Month cell chip: .tag-chip is unlayered CSS, so its display wins over Tailwind utilities.
function MonthChip({ item }: { item: Item }) {
  const props = { className: "tag-chip w-full truncate", "data-tone": item.google ? "teal" : colorTone(item.color), style: { display: "block" }, title: formatTime(item.startsAt) + " " + item.title }
  return item.google
    ? <a href={item.href} target="_blank" rel="noopener noreferrer" {...props}>{item.title}</a>
    : <Link href={item.href} {...props}>{item.title}</Link>
}

function EventRow({ item }: { item: Item }) {
  const Icon = item.google ? ExternalLink : item.recurrence ? Repeat : CalendarDays
  return (
    <li className="issue-row">
      <Icon size={16} className="issue-row-icon" aria-hidden />
      <div className="min-w-0 flex-1">
        <EventTitle item={item} className="issue-row-title" />
        <p className="issue-row-meta">
          {formatTime(item.startsAt)}–{formatTime(item.endsAt)}
          {item.google ? " · Google Calendar · read-only" : item.recurrence ? " · " + repeatLabel(item.recurrence) : ""}
        </p>
      </div>
      <div className="issue-row-side">
        {item.google ? <span className="tag-chip" data-tone="teal">Google</span> : <span className="tag-chip" data-tone={colorTone(item.color)}>{colorLabel(item.color)}</span>}
      </div>
    </li>
  )
}

function DayGroups({ groups, todayKey, emptyText }: { groups: Array<[string, Item[]]>; todayKey: string; emptyText?: string }) {
  if (!groups.length) return <div className="issue-empty"><h2>Nothing scheduled</h2><p>{emptyText ?? "No events in this range."}</p></div>
  return (
    <div>
      {groups.map(([day, items]) => (
        <section key={day} className="mt-5 first:mt-4" aria-label={formatKeyLong(day)}>
          <h3 className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <span>{formatKeyLong(day)}{day === todayKey ? " · Today" : ""}</span>
            <Link href={"/calendar/new?date=" + day} className="button-quiet min-h-0 px-2 py-1 normal-case tracking-normal" aria-label={"New event on " + formatKeyLong(day)}><Plus size={13} /></Link>
          </h3>
          {items.length ? <ul className="issue-list mt-2">{items.map((item) => <EventRow key={item.key} item={item} />)}</ul> : <p className="mt-2 border-t border-[var(--line)] py-3 text-sm text-[var(--muted)]">No events.</p>}
        </section>
      ))}
    </div>
  )
}

export function CalendarBoard({ events, googleEvents, todayKey, initialView }: Props) {
  const [view, setViewState] = useState<CalendarView>(initialView)
  const [cursor, setCursor] = useState(todayKey)
  const [showPast, setShowPast] = useState(false)

  const items = useMemo<Item[]>(() => [
    ...events.map((event) => ({ key: event.id, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, day: dayKey(event.startsAt), href: "/calendar/" + event.sourceId, google: false, color: event.color, recurrence: event.recurrence })),
    ...googleEvents.map((event) => ({ key: "google:" + event.id, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, day: dayKey(event.startsAt), href: event.htmlLink ?? "https://calendar.google.com", google: true, color: "", recurrence: null })),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [events, googleEvents])
  const byDay = useMemo(() => new Map(groupByDay(items)), [items])

  function setView(next: CalendarView) {
    setViewState(next)
    const url = new URL(window.location.href)
    if (next === "agenda") url.searchParams.delete("view")
    else url.searchParams.set("view", next)
    url.searchParams.delete("success")
    url.searchParams.delete("error")
    window.history.replaceState(null, "", url.pathname + url.search)
  }
  function openDay(day: string) {
    setCursor(day)
    setView("day")
  }
  function step(direction: 1 | -1) {
    setCursor((current) => view === "month" ? addMonthsToKey(current, direction) : addDaysToKey(current, view === "week" ? 7 * direction : direction))
  }

  const upcomingItems = items.filter((item) => item.day >= todayKey)
  const pastItems = items.filter((item) => item.day < todayKey)
  const monthStart = cursor.slice(0, 8) + "01"
  const weekStart = addDaysToKey(cursor, -weekdayOfKey(cursor))
  const weekDays = Array.from({ length: 7 }, (_, index) => addDaysToKey(weekStart, index))
  const rangeLabel = view === "month" ? formatKeyMonth(cursor) : view === "week" ? formatKeyShort(weekDays[0]) + " – " + formatKeyShort(weekDays[6]) : formatKeyLong(cursor)

  return (
    <section aria-label="Calendar">
      <div className="issue-list-head">
        <nav aria-label="Calendar views" className="issue-tabs">
          {views.map(([key, text]) => (
            <button key={key} type="button" onClick={() => setView(key)} aria-current={view === key ? "page" : undefined} className={"issue-tab" + (view === key ? " is-active" : "")}>
              {text}{key === "agenda" && <span className="issue-tab-count">{upcomingItems.length}</span>}
            </button>
          ))}
        </nav>
        {view !== "agenda" && (
          <div className="flex min-w-0 items-center gap-1 pb-2">
            <button type="button" onClick={() => step(-1)} className="button-secondary min-h-0 p-1.5" aria-label={"Previous " + view}><ChevronLeft size={16} /></button>
            <button type="button" onClick={() => setCursor(todayKey)} className="button-secondary min-h-0 px-3 py-1.5 text-xs">Today</button>
            <button type="button" onClick={() => step(1)} className="button-secondary min-h-0 p-1.5" aria-label={"Next " + view}><ChevronRight size={16} /></button>
            <span className="ml-2 truncate text-sm font-semibold">{rangeLabel}</span>
          </div>
        )}
      </div>

      {view === "agenda" && (
        <>
          <DayGroups groups={groupByDay(upcomingItems)} todayKey={todayKey} emptyText="Your calendar is clear. Create an event to start building your agenda." />
          {pastItems.length > 0 && (
            <div className="mt-5">
              <button type="button" onClick={() => setShowPast((shown) => !shown)} className="issue-timeline-more">{showPast ? "Hide past events" : "Show " + pastItems.length + " past " + (pastItems.length === 1 ? "event" : "events")}</button>
              {showPast && <DayGroups groups={groupByDay(pastItems).reverse()} todayKey={todayKey} />}
            </div>
          )}
        </>
      )}

      {view === "month" && (
        <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]">
          <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[var(--surface-muted)] text-center text-[11px] font-semibold text-[var(--muted)] sm:text-xs">
            {weekdays.map((day) => <div key={day} className="px-0.5 py-2 sm:p-2.5"><span className="sm:hidden">{day.slice(0, 1)}</span><span className="hidden sm:inline">{day}</span></div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: weekdayOfKey(monthStart) }).map((_, index) => <div key={"empty-" + index} className="min-h-14 border-b border-r border-[var(--line)] bg-[var(--surface-muted)] opacity-50 sm:min-h-24" />)}
            {Array.from({ length: daysInMonthOfKey(monthStart) }, (_, index) => addDaysToKey(monthStart, index)).map((day) => {
              const dayItems = byDay.get(day) ?? []
              return (
                <div key={day} className="group min-h-14 min-w-0 border-b border-r border-[var(--line)] p-1 sm:min-h-24 sm:p-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <button type="button" onClick={() => openDay(day)} aria-label={"Open " + formatKeyLong(day)} className={day === todayKey ? "grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--on-accent)]" : "grid h-6 w-6 place-items-center rounded-full text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface-muted)]"}>
                      {Number(day.slice(8))}
                    </button>
                    <Link href={"/calendar/new?date=" + day} aria-label={"New event on " + formatKeyLong(day)} className="hidden rounded p-0.5 text-[var(--muted)] opacity-0 hover:bg-[var(--surface-muted)] focus:opacity-100 group-hover:opacity-100 sm:block"><Plus size={13} /></Link>
                  </div>
                  {/* Phones: coloured dots, tap the day for the list. */}
                  {dayItems.length > 0 && (
                    <button type="button" onClick={() => openDay(day)} className="mt-1 flex flex-wrap gap-0.5 sm:hidden" aria-label={dayItems.length + " events on " + formatKeyLong(day)}>
                      {dayItems.slice(0, 4).map((item) => <span key={item.key} className="tag-chip" data-tone={item.google ? "teal" : colorTone(item.color)} style={{ width: 6, height: 6, padding: 0, background: "var(--tag)" }} />)}
                    </button>
                  )}
                  <div className="mt-1 hidden space-y-1 sm:block">
                    {dayItems.slice(0, 2).map((item) => <MonthChip key={item.key} item={item} />)}
                    {dayItems.length > 2 && <button type="button" onClick={() => openDay(day)} className="text-[11px] text-[var(--muted)] hover:underline">+{dayItems.length - 2} more</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === "week" && <DayGroups groups={weekDays.map((day) => [day, byDay.get(day) ?? []])} todayKey={todayKey} />}

      {view === "day" && (
        <>
          <DayGroups groups={[[cursor, byDay.get(cursor) ?? []]]} todayKey={todayKey} />
          <Link href={"/calendar/new?date=" + cursor} className="button-secondary mt-4 min-h-0 px-3 py-1.5 text-sm"><Plus size={14} className="mr-1.5" />New event on this day</Link>
        </>
      )}
    </section>
  )
}

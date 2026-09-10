export const accents = {
  indigo: { label: "Graphite", color: "#111111", hover: "#2f333b" },
  blue: { label: "Blue", color: "#2563eb", hover: "#1d4ed8" },
  emerald: { label: "Green", color: "#059669", hover: "#047857" },
  orange: { label: "Orange", color: "#ea580c", hover: "#c2410c" },
  rose: { label: "Red", color: "#e11d48", hover: "#be123c" },
  pink: { label: "Pink", color: "#db2777", hover: "#be185d" },
  gray: { label: "Gray", color: "#64748b", hover: "#475569" },
} as const

export type Accent = keyof typeof accents
export type Density = "comfortable" | "compact"
export type Theme = "light" | "dark" | "system"
export type SidebarMode = "expanded" | "compact" | "icon" | "floating"
export type FontSize = "small" | "medium" | "large"
export type FontFamily = "geist" | "inter" | "manrope"
export type DashboardWidgets = { welcome: boolean; storage: boolean; activity: boolean; calendar: boolean; notes: boolean; tasks: boolean }
export type CustomizePreferences = { accent: Accent; density: Density; radius: number; theme: Theme; sidebarMode: SidebarMode; fontSize: FontSize; fontFamily: FontFamily; animations: boolean; reducedMotion: boolean; highContrast: boolean; focusRing: boolean; largeText: boolean; widgets: DashboardWidgets }

export const defaultCustomizePreferences: CustomizePreferences = {
  accent: "indigo", density: "comfortable", radius: 16, theme: "dark", sidebarMode: "expanded", fontSize: "medium", fontFamily: "geist", animations: true, reducedMotion: false, highContrast: false, focusRing: true, largeText: false,
  widgets: { welcome: true, storage: true, activity: true, calendar: true, notes: true, tasks: true },
}

const storageKey = "lifehub:customize"
const themes = new Set<Theme>(["light", "dark", "system"])
const sidebarModes = new Set<SidebarMode>(["expanded", "compact", "icon", "floating"])
const fontSizes = new Set<FontSize>(["small", "medium", "large"])
const fontFamilies = new Set<FontFamily>(["geist", "inter", "manrope"])

export function accentForTheme(theme: "light" | "dark") {
  if (typeof window === "undefined") return theme === "light" ? "gray" as Accent : "indigo" as Accent
  const stored = window.localStorage.getItem(`sanctumcove:accent-${theme}`)
  return stored && stored in accents ? stored as Accent : theme === "light" ? "gray" : "indigo"
}

export function readCustomizePreferences(): CustomizePreferences {
  if (typeof window === "undefined") return { ...defaultCustomizePreferences, widgets: { ...defaultCustomizePreferences.widgets } }
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Partial<CustomizePreferences>
    const theme = stored.theme && themes.has(stored.theme) ? stored.theme : defaultCustomizePreferences.theme
    const resolvedTheme = theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme
    const legacyAccent = stored.accent && stored.accent in accents ? stored.accent as Accent : undefined
    const accent = accentForTheme(resolvedTheme) ?? legacyAccent ?? (resolvedTheme === "light" ? "gray" : "indigo")
    window.localStorage.setItem(`sanctumcove:accent-${resolvedTheme}`, accent)
    const radius = typeof stored.radius === "number" && stored.radius >= 8 && stored.radius <= 24 ? stored.radius : defaultCustomizePreferences.radius
    const widgets = { ...defaultCustomizePreferences.widgets, ...(stored.widgets && typeof stored.widgets === "object" ? stored.widgets : {}) }
    return {
      accent, radius, widgets: Object.fromEntries(Object.entries(widgets).map(([key, value]) => [key, Boolean(value)])) as DashboardWidgets,
      density: stored.density === "compact" ? "compact" : defaultCustomizePreferences.density,
      theme,
      sidebarMode: stored.sidebarMode && sidebarModes.has(stored.sidebarMode) ? stored.sidebarMode : defaultCustomizePreferences.sidebarMode,
      fontSize: stored.fontSize && fontSizes.has(stored.fontSize) ? stored.fontSize : defaultCustomizePreferences.fontSize,
      fontFamily: stored.fontFamily && fontFamilies.has(stored.fontFamily) ? stored.fontFamily : defaultCustomizePreferences.fontFamily,
      animations: typeof stored.animations === "boolean" ? stored.animations : defaultCustomizePreferences.animations,
      reducedMotion: typeof stored.reducedMotion === "boolean" ? stored.reducedMotion : defaultCustomizePreferences.reducedMotion,
      highContrast: typeof stored.highContrast === "boolean" ? stored.highContrast : defaultCustomizePreferences.highContrast,
      focusRing: typeof stored.focusRing === "boolean" ? stored.focusRing : defaultCustomizePreferences.focusRing,
      largeText: typeof stored.largeText === "boolean" ? stored.largeText : defaultCustomizePreferences.largeText,
    }
  } catch {
    return { ...defaultCustomizePreferences, widgets: { ...defaultCustomizePreferences.widgets } }
  }
}

export function applyCustomizePreferences(preferences: CustomizePreferences) {
  const root = document.documentElement
  const resolvedTheme = preferences.theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : preferences.theme
  const accentName = accentForTheme(resolvedTheme) === preferences.accent ? preferences.accent : preferences.accent
  const accent = accents[accentName]
  window.localStorage.setItem(`sanctumcove:accent-${resolvedTheme}`, accentName)
  const fontFamilies: Record<FontFamily, string> = { geist: "var(--font-geist-sans)", inter: "var(--font-inter)", manrope: "var(--font-manrope)" }
  root.dataset.theme = resolvedTheme
  root.dataset.density = preferences.density
  root.dataset.sidebarMode = preferences.sidebarMode
  root.dataset.motion = preferences.animations && !preferences.reducedMotion ? "on" : "off"
  root.dataset.contrast = preferences.highContrast ? "high" : "normal"
  root.dataset.focusRing = preferences.focusRing ? "on" : "off"
  root.dataset.customized = "true"
  Object.entries(preferences.widgets).forEach(([widget, visible]) => root.dataset["widget" + widget[0].toUpperCase() + widget.slice(1)] = String(visible))
  root.style.setProperty("--accent", accent.color)
  root.style.setProperty("--accent-hover", accent.hover)
  root.style.setProperty("--radius-card", preferences.radius + "px")
  root.style.setProperty("--radius-control", Math.max(8, preferences.radius - 4) + "px")
  root.style.setProperty("--font-lifehub", fontFamilies[preferences.fontFamily])
  root.style.setProperty("--font-size-lifehub", preferences.largeText ? "18px" : preferences.fontSize === "small" ? "14px" : preferences.fontSize === "large" ? "18px" : "16px")
  root.style.setProperty("--sidebar-expanded-width", preferences.sidebarMode === "compact" ? "220px" : "256px")
  window.localStorage.setItem(storageKey, JSON.stringify(preferences))
  window.localStorage.setItem("lifehub:theme-preference", preferences.theme)
  window.dispatchEvent(new Event("lifehub:theme-change"))
  window.dispatchEvent(new Event("lifehub:customize-change"))
}

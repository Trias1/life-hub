// Client components are rendered on the server first, so dates must not depend on the
// runtime's default locale or time zone, or hydration fails when they differ.
const LOCALE = "en-GB"
const TIME_ZONE = "Asia/Jakarta"

const dateFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" })
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
const dayMonthFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: "numeric", month: "short" })
const monthYearFormat = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, month: "long", year: "numeric" })

export const formatDate = (value: string | number | Date) => dateFormat.format(new Date(value))
export const formatDateTime = (value: string | number | Date) => dateTimeFormat.format(new Date(value))
export const formatDayMonth = (value: string | number | Date) => dayMonthFormat.format(new Date(value))
export const formatMonthYear = (value: string | number | Date) => monthYearFormat.format(new Date(value))

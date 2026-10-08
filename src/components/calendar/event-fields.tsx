import { DateTimePicker } from "@/components/date-time-picker"
import { Select } from "@/components/ui/select"
import { colorOptions, reminderOptions, repeatOptions } from "./calendar-format"

type Defaults = { title?: string; description?: string; startsAt: string; endsAt: string; recurrence?: string; reminder?: string; color?: string }

/** Shared fields for the new-event page and the inline edit form; names match parseEvent in calendar/actions.ts. */
export function EventFields({ idPrefix, defaults, autoFocus = false }: { idPrefix: string; defaults: Defaults; autoFocus?: boolean }) {
  return (
    <>
      <div className="issue-form-field">
        <label htmlFor={idPrefix + "-title"} className="issue-form-label">Title <span className="font-normal text-[var(--muted)]">(required)</span></label>
        <input id={idPrefix + "-title"} name="title" required maxLength={160} autoFocus={autoFocus} defaultValue={defaults.title} className="field-control" />
      </div>
      <div className="issue-form-field">
        <label htmlFor={idPrefix + "-description"} className="issue-form-label">Description</label>
        <textarea id={idPrefix + "-description"} name="description" maxLength={1000} defaultValue={defaults.description} placeholder="Agenda, location, or a link to the call" className="field-control min-h-28 resize-y" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="issue-form-field">
          <span className="issue-form-label">Starts</span>
          <DateTimePicker name="startsAt" defaultValue={defaults.startsAt} required />
        </div>
        <div className="issue-form-field">
          <span className="issue-form-label">Ends</span>
          <DateTimePicker name="endsAt" defaultValue={defaults.endsAt} required />
          <p className="text-xs text-[var(--muted)]">Must be after the start.</p>
        </div>
        <div className="issue-form-field">
          <label htmlFor={idPrefix + "-repeat"} className="issue-form-label">Repeat</label>
          <Select id={idPrefix + "-repeat"} name="recurrence" defaultValue={defaults.recurrence ?? ""} placeholder="Does not repeat" options={repeatOptions} className="field-control" />
        </div>
        <div className="issue-form-field">
          <label htmlFor={idPrefix + "-reminder"} className="issue-form-label">Reminder</label>
          <Select id={idPrefix + "-reminder"} name="reminder" defaultValue={defaults.reminder ?? "0"} options={reminderOptions} className="field-control" />
        </div>
        <div className="issue-form-field">
          <label htmlFor={idPrefix + "-color"} className="issue-form-label">Colour</label>
          <Select id={idPrefix + "-color"} name="color" defaultValue={defaults.color ?? "indigo"} options={colorOptions} className="field-control" />
        </div>
      </div>
    </>
  )
}

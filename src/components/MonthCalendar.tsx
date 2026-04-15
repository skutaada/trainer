import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Moon, Repeat2 } from 'lucide-react'
import { useWorkoutStore } from '../store/workoutStore'
import type { DayPlan, WeekdayPlan, WeeklyRule } from '../types'
import { Modal } from './Modal'
import { WeeklyRhythm } from './WeeklyRhythm'

const weekdaysShort = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const weekdaysLong = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

function weeklyPlanForIso(iso: string, rules: WeeklyRule[]): WeekdayPlan | undefined {
  const d = parseISO(iso)
  if (Number.isNaN(d.getTime())) return undefined
  const dow = mondayIndex(d)
  return rules.find((r) => r.dayOfWeek === dow)?.plan
}

function iso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function MonthCalendar() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const schedule = useWorkoutStore((s) => s.schedule)
  const workouts = useWorkoutStore((s) => s.workouts)
  const weeklyRules = useWorkoutStore((s) => s.weeklyRules)
  const setDayPlan = useWorkoutStore((s) => s.setDayPlan)
  const setDayCompleted = useWorkoutStore((s) => s.setDayCompleted)
  const saveWeeklyRules = useWorkoutStore((s) => s.saveWeeklyRules)

  const [activeDate, setActiveDate] = useState<Date | null>(null)

  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const pad = mondayIndex(monthStart)
  const cells = useMemo(() => {
    const totalCells = Math.ceil((pad + daysInMonth.length) / 7) * 7
    const out: { date: Date | null }[] = []
    for (let i = 0; i < pad; i++) out.push({ date: null })
    for (const d of daysInMonth) out.push({ date: d })
    while (out.length < totalCells) out.push({ date: null })
    return out
  }, [pad, daysInMonth])

  const workoutById = useMemo(() => {
    const m = new Map(workouts.map((w) => [w.id, w]))
    return m
  }, [workouts])

  const activeIso = activeDate ? iso(activeDate) : null
  const activeExplicit = activeIso ? schedule[activeIso] : undefined
  const activeWeeklyDefault =
    activeIso ? weeklyPlanForIso(activeIso, weeklyRules) : undefined

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Monthly plan
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          Pick a month, then tap a day for a workout or rest. When you save a
          day, confirm you did it to include it on the activity heatmap. Weekly
          rhythm below sets defaults (Mon–Sun). Swipe the grid on small screens
          if needed.
        </p>
      </div>

      <WeeklyRhythm
        workouts={workouts}
        weeklyRules={weeklyRules}
        onSave={(rules) => saveWeeklyRules(rules)}
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-4">
        <button
          type="button"
          onClick={() => setCursor((c) => subMonths(c, 1))}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-base font-medium text-zinc-200 hover:bg-white/5 sm:w-auto sm:px-3 sm:text-sm"
        >
          <ChevronLeft className="size-5 sm:size-4" />
          Previous
        </button>
        <p className="order-first text-center text-base font-semibold text-white tabular-nums sm:order-none sm:text-lg">
          {format(cursor, 'MMMM yyyy')}
        </p>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-base font-medium text-zinc-200 hover:bg-white/5 sm:w-auto sm:px-3 sm:text-sm"
        >
          Next
          <ChevronRight className="size-5 sm:size-4" />
        </button>
      </div>

      <div className="-mx-1 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-2 sm:mx-0 sm:p-4">
        <div className="grid min-w-[320px] grid-cols-7 gap-1.5 px-1 sm:min-w-0 sm:gap-1">
          {weekdaysShort.map((w, i) => (
            <div
              key={weekdaysLong[i]}
              className="pb-1 text-center text-[11px] font-semibold text-zinc-500 sm:pb-2"
            >
              <span className="sm:hidden">{w}</span>
              <span className="hidden sm:inline">{weekdaysLong[i]}</span>
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell.date) {
              return (
                <div
                  key={`empty-${i}`}
                  className="min-h-[2.85rem] rounded-xl bg-transparent sm:aspect-square sm:min-h-0"
                />
              )
            }
            const d = cell.date
            const key = iso(d)
            const explicit = schedule[key]
            const weekly = weeklyPlanForIso(key, weeklyRules)
            const plan = explicit ?? weekly
            const fromWeeklyOnly = !explicit && !!weekly
            const needsDone =
              !!explicit && !explicit.completed
            const label =
              plan?.kind === 'rest'
                ? 'Rest'
                : plan?.kind === 'workout'
                  ? workoutById.get(plan.workoutId)?.name ?? 'Workout'
                  : null

            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveDate(d)}
                className={[
                  'relative flex min-h-[2.85rem] flex-col gap-0.5 rounded-xl border p-1.5 text-left transition active:scale-[0.98] sm:aspect-square sm:min-h-0 sm:p-1.5',
                  'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50',
                  explicit?.completed
                    ? 'border-emerald-800/40 bg-emerald-950/15'
                    : '',
                  isToday(d)
                    ? 'ring-2 ring-[var(--color-accent)]/40'
                    : needsDone
                      ? 'ring-2 ring-amber-500/35'
                      : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'text-sm font-semibold tabular-nums sm:text-xs',
                    isToday(d) ? 'text-[var(--color-accent)]' : 'text-zinc-300',
                  ].join(' ')}
                >
                  {format(d, 'd')}
                </span>
                {label ? (
                  <span className="line-clamp-2 text-[10px] leading-tight text-zinc-400 sm:text-[11px]">
                    <span className="inline-flex flex-wrap items-center gap-0.5">
                      {fromWeeklyOnly ? (
                        <Repeat2
                          className="size-3 shrink-0 text-zinc-500"
                          aria-label="Weekly default"
                        />
                      ) : null}
                      {plan?.kind === 'rest' ? (
                        <span className="inline-flex items-center gap-0.5 text-violet-300/90">
                          <Moon className="size-3 shrink-0" />
                          Rest
                        </span>
                      ) : (
                        label
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-600">—</span>
                )}
                {explicit?.completed ? (
                  <Check
                    className="pointer-events-none absolute bottom-1 right-1 size-3.5 text-emerald-400/90 sm:bottom-0.5 sm:right-0.5 sm:size-3"
                    aria-label="Marked done"
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <Modal
        title={activeDate ? format(activeDate, 'EEEE, MMM d') : 'Day'}
        open={!!activeDate}
        onClose={() => setActiveDate(null)}
      >
        {activeDate && activeIso ? (
          <DayEditor
            key={activeIso}
            iso={activeIso}
            explicitPlan={activeExplicit}
            weeklyDefault={activeWeeklyDefault}
            workouts={workouts}
            onSetCompleted={async (done) => {
              try {
                await setDayCompleted(activeIso, done)
              } catch {
                /* store */
              }
            }}
            onSave={async (plan) => {
              try {
                await setDayPlan(activeIso, plan)
                setActiveDate(null)
              } catch {
                /* error surfaced in store */
              }
            }}
            onClear={async () => {
              try {
                await setDayPlan(activeIso, null)
                setActiveDate(null)
              } catch {
                /* error surfaced in store */
              }
            }}
          />
        ) : null}
      </Modal>
    </div>
  )
}

function DayEditor({
  iso: _iso,
  explicitPlan,
  weeklyDefault,
  workouts,
  onSetCompleted,
  onSave,
  onClear,
}: {
  iso: string
  explicitPlan: DayPlan | undefined
  weeklyDefault: WeekdayPlan | undefined
  workouts: { id: string; name: string }[]
  onSetCompleted: (done: boolean) => Promise<void>
  onSave: (p: DayPlan) => Promise<void>
  onClear: () => Promise<void>
}) {
  const base = explicitPlan ?? weeklyDefault
  const [kind, setKind] = useState<'rest' | 'workout'>(() =>
    base?.kind === 'workout' ? 'workout' : 'rest',
  )
  const [workoutId, setWorkoutId] = useState(
    base?.kind === 'workout' ? base.workoutId : workouts[0]?.id ?? '',
  )
  const [pending, setPending] = useState(false)
  const [doneBusy, setDoneBusy] = useState(false)

  useEffect(() => {
    const b = explicitPlan ?? weeklyDefault
    setKind(b?.kind === 'workout' ? 'workout' : 'rest')
    setWorkoutId(
      b?.kind === 'workout' ? b.workoutId : workouts[0]?.id ?? '',
    )
  }, [_iso, explicitPlan, weeklyDefault, workouts])

  return (
    <div className="space-y-4 text-left">
      <p className="text-xs text-zinc-500 font-mono">{_iso}</p>
      {!explicitPlan && weeklyDefault ? (
        <p className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs leading-relaxed text-zinc-400">
          <Repeat2 className="mt-0.5 size-3.5 shrink-0 text-zinc-500" aria-hidden />
          <span>
            No one-off entry for this date — the form matches your weekly
            default. Saving writes an explicit day on the calendar.
          </span>
        </p>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="sr-only">Day type</legend>
        <label className="flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] p-4 has-[:checked]:border-[var(--color-accent)]/50 has-[:checked]:bg-[var(--color-accent)]/10">
          <input
            type="radio"
            name="daykind"
            checked={kind === 'rest'}
            onChange={() => setKind('rest')}
            className="size-5 shrink-0 accent-[var(--color-accent)]"
          />
          <div>
            <p className="text-base font-medium text-white">Rest day</p>
            <p className="text-sm text-zinc-500">Recovery or off from training</p>
          </div>
        </label>
        <label className="flex min-h-[3.25rem] cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] p-4 has-[:checked]:border-[var(--color-accent)]/50 has-[:checked]:bg-[var(--color-accent)]/10">
          <input
            type="radio"
            name="daykind"
            checked={kind === 'workout'}
            onChange={() => setKind('workout')}
            className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-white">Workout</p>
            {workouts.length === 0 ? (
              <p className="mt-1 text-sm text-amber-400/90">
                Create a workout template first.
              </p>
            ) : (
              <select
                value={workoutId}
                onChange={(e) => setWorkoutId(e.target.value)}
                disabled={kind !== 'workout'}
                className="mt-2 w-full min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base text-white disabled:opacity-50 sm:text-sm"
              >
                {workouts.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </label>
      </fieldset>
      {explicitPlan ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={explicitPlan.completed}
              disabled={doneBusy}
              onChange={async (e) => {
                setDoneBusy(true)
                try {
                  await onSetCompleted(e.target.checked)
                } finally {
                  setDoneBusy(false)
                }
              }}
              className="mt-0.5 size-5 shrink-0 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
            />
            <div>
              <p className="text-sm font-medium text-white">
                I did this (counts on heatmap)
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                The team activity view only shows days you check here. Changing
                the workout above clears this until you confirm again.
              </p>
            </div>
          </label>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-zinc-600">
          Save this day first, then you can confirm it for the heatmap.
        </p>
      )}
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={async () => {
            setPending(true)
            try {
              if (kind === 'rest')
                await onSave({ kind: 'rest', completed: false })
              else if (workoutId)
                await onSave({
                  kind: 'workout',
                  workoutId,
                  completed: false,
                })
            } finally {
              setPending(false)
            }
          }}
          disabled={
            pending ||
            (kind === 'workout' && (!workoutId || workouts.length === 0))
          }
          className="min-h-12 w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-base font-semibold text-[var(--color-surface)] hover:brightness-110 disabled:opacity-40 sm:w-auto sm:text-sm"
        >
          {pending ? 'Saving…' : 'Save day'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true)
            try {
              await onClear()
            } finally {
              setPending(false)
            }
          }}
          className="min-h-12 w-full rounded-xl border border-[var(--color-border)] px-4 py-3 text-base text-zinc-200 hover:bg-white/5 disabled:opacity-40 sm:w-auto sm:text-sm"
        >
          Clear assignment
        </button>
      </div>
    </div>
  )
}

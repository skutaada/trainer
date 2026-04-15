import { useEffect, useState } from 'react'
import type { WeeklyRule, WorkoutTemplate } from '../types'

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type DraftRow = {
  mode: 'none' | 'rest' | 'workout'
  workoutId: string
}

function rulesToDraft(rules: WeeklyRule[]): DraftRow[] {
  const byDow = new Map(rules.map((r) => [r.dayOfWeek, r]))
  return Array.from({ length: 7 }, (_, dow) => {
    const r = byDow.get(dow)
    if (!r) return { mode: 'none' as const, workoutId: '' }
    if (r.plan.kind === 'rest') return { mode: 'rest' as const, workoutId: '' }
    return { mode: 'workout' as const, workoutId: r.plan.workoutId }
  })
}

function draftToRules(draft: DraftRow[]): WeeklyRule[] {
  const out: WeeklyRule[] = []
  draft.forEach((row, dow) => {
    if (row.mode === 'none') return
    if (row.mode === 'rest') {
      out.push({ dayOfWeek: dow, plan: { kind: 'rest' } })
      return
    }
    if (row.workoutId) {
      out.push({
        dayOfWeek: dow,
        plan: { kind: 'workout', workoutId: row.workoutId },
      })
    }
  })
  return out
}

export function WeeklyRhythm({
  workouts,
  weeklyRules,
  onSave,
  disabled,
}: {
  workouts: WorkoutTemplate[]
  weeklyRules: WeeklyRule[]
  onSave: (rules: WeeklyRule[]) => Promise<void>
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(() => rulesToDraft(weeklyRules))
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setDraft(rulesToDraft(weeklyRules))
  }, [weeklyRules])

  const updateRow = (dow: number, patch: Partial<DraftRow>) => {
    setDraft((rows) =>
      rows.map((row, i) => (i === dow ? { ...row, ...patch } : row)),
    )
  }

  const rulesPayload = draftToRules(draft)
  const canon = (r: WeeklyRule[]) =>
    [...r].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  const dirty =
    JSON.stringify(canon(rulesPayload)) !== JSON.stringify(canon(weeklyRules))

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 sm:p-5">
      <h3 className="text-base font-semibold text-white sm:text-lg">
        Weekly rhythm
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
        Set a default for each weekday (e.g. legs every Monday). One-off days
        on the calendar still override these.
      </p>

      <ul className="mt-4 space-y-2">
        {draft.map((row, dow) => (
          <li
            key={dow}
            className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="w-12 shrink-0 text-sm font-medium text-zinc-300">
              {dayLabels[dow]}
            </span>
            <select
              value={row.mode}
              onChange={(e) => {
                const mode = e.target.value as DraftRow['mode']
                updateRow(dow, {
                  mode,
                  workoutId:
                    mode === 'workout'
                      ? row.workoutId || workouts[0]?.id || ''
                      : '',
                })
              }}
              disabled={disabled || pending}
              className="min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-white disabled:opacity-50 sm:max-w-[10rem]"
            >
              <option value="none">Default (empty)</option>
              <option value="rest">Rest</option>
              <option value="workout">Workout</option>
            </select>
            {row.mode === 'workout' ? (
              workouts.length === 0 ? (
                <p className="text-xs text-amber-400/90">
                  Add a workout template first.
                </p>
              ) : (
                <select
                  value={row.workoutId}
                  onChange={(e) =>
                    updateRow(dow, { workoutId: e.target.value })
                  }
                  disabled={disabled || pending}
                  className="min-h-11 w-full flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  {workouts.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              )
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={
            disabled ||
            pending ||
            !dirty ||
            draft.some(
              (r) =>
                r.mode === 'workout' && (!r.workoutId || workouts.length === 0),
            )
          }
          onClick={async () => {
            setPending(true)
            try {
              await onSave(rulesPayload)
            } finally {
              setPending(false)
            }
          }}
          className="min-h-12 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-[var(--color-surface)] hover:brightness-110 disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Save weekly pattern'}
        </button>
        <button
          type="button"
          disabled={disabled || pending || !dirty}
          onClick={() => setDraft(rulesToDraft(weeklyRules))}
          className="min-h-12 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-40"
        >
          Discard changes
        </button>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() =>
            setDraft(Array.from({ length: 7 }, () => ({ mode: 'none' as const, workoutId: '' })))
          }
          className="min-h-12 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-40"
        >
          Empty all weekdays
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        After &quot;Empty all weekdays&quot;, save to drop the repeating pattern
        from the server.
      </p>
    </section>
  )
}

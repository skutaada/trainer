import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import { useWorkoutStore } from '../store/workoutStore'
import type { WorkoutExerciseSlot, WorkoutTemplate } from '../types'

const defaultSlot = (exerciseId: string): WorkoutExerciseSlot => ({
  exerciseId,
  sets: 3,
  reps: '10',
})

function formatPrescription(s: WorkoutExerciseSlot): string {
  if (s.sets == null && (s.reps == null || s.reps === '')) return ''
  if (s.sets != null && s.reps != null && s.reps !== '')
    return `${s.sets}×${s.reps}`
  if (s.sets != null) return `${s.sets} sets`
  if (s.reps != null && s.reps !== '') return s.reps
  return ''
}

export function WorkoutBuilder() {
  const exercises = useWorkoutStore((s) => s.exercises)
  const workouts = useWorkoutStore((s) => s.workouts)
  const addWorkout = useWorkoutStore((s) => s.addWorkout)
  const updateWorkout = useWorkoutStore((s) => s.updateWorkout)
  const removeWorkout = useWorkoutStore((s) => s.removeWorkout)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [slots, setSlots] = useState<WorkoutExerciseSlot[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  const exerciseById = useMemo(() => {
    const m = new Map(exercises.map((e) => [e.id, e]))
    return m
  }, [exercises])

  const resetForm = () => {
    setName('')
    setDescription('')
    setSlots([])
    setEditingId(null)
  }

  const startEdit = (w: WorkoutTemplate) => {
    setEditingId(w.id)
    setName(w.name)
    setDescription(w.description)
    setSlots(
      w.exercises.map((s) => ({
        exerciseId: s.exerciseId,
        sets: s.sets,
        reps: s.reps ?? '',
      })),
    )
  }

  const addToWorkout = (exerciseId: string) => {
    setSlots((list) => [...list, defaultSlot(exerciseId)])
  }

  const move = (index: number, dir: -1 | 1) => {
    setSlots((list) => {
      const j = index + dir
      if (j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  const removeAt = (index: number) => {
    setSlots((list) => list.filter((_, i) => i !== index))
  }

  const updateSlot = (
    index: number,
    patch: Partial<Pick<WorkoutExerciseSlot, 'sets' | 'reps'>>,
  ) => {
    setSlots((list) =>
      list.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    )
  }

  const normalizeSlotsForApi = (list: WorkoutExerciseSlot[]): WorkoutExerciseSlot[] =>
    list.map((s) => ({
      exerciseId: s.exerciseId,
      sets:
        s.sets === null || s.sets === undefined || Number.isNaN(s.sets)
          ? null
          : s.sets,
      reps: s.reps != null && String(s.reps).trim() !== '' ? String(s.reps).trim() : null,
    }))

  const saveWorkout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const payload = {
      name: name.trim(),
      description: description.trim(),
      exercises: normalizeSlotsForApi(slots),
    }
    try {
      if (editingId) {
        await updateWorkout(editingId, payload)
      } else {
        await addWorkout(payload)
      }
      resetForm()
    } catch {
      /* error surfaced in store */
    }
  }

  const availableToAdd = exercises.filter(
    (e) => !slots.some((s) => s.exerciseId === e.id),
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Workout templates
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          Build each session from the shared library. For every exercise you can
          set sets and reps (reps can be numbers or ranges like 8–12).
        </p>
      </div>

      <form
        onSubmit={saveWorkout}
        className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 sm:p-5"
      >
        <span className="text-sm font-medium text-zinc-300">
          {editingId ? 'Edit workout' : 'New workout'}
        </span>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Workout name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Upper A — strength"
              className="w-full min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Target RPE, superset rules, equipment…"
              className="w-full min-h-[5.5rem] resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Exercise order
          </p>
          {slots.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Add exercises from the list below.
            </p>
          ) : (
            <ol className="space-y-3">
              {slots.map((slot, index) => {
                const ex = exerciseById.get(slot.exerciseId)
                return (
                  <li
                    key={`${slot.exerciseId}-${index}`}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <GripVertical
                          className="mt-1 size-5 shrink-0 text-zinc-600"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white">
                            {ex?.name ?? 'Unknown exercise'}
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                                Sets
                              </label>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                placeholder="—"
                                value={slot.sets ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === '') {
                                    updateSlot(index, { sets: null })
                                    return
                                  }
                                  const n = Number(v)
                                  updateSlot(
                                    index,
                                    Number.isInteger(n) && n >= 1
                                      ? { sets: n }
                                      : { sets: null },
                                  )
                                }}
                                className="w-full min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-center text-base text-white placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                                Reps
                              </label>
                              <input
                                type="text"
                                inputMode="text"
                                placeholder="e.g. 10"
                                value={slot.reps ?? ''}
                                onChange={(e) =>
                                  updateSlot(index, { reps: e.target.value })
                                }
                                className="w-full min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-base text-white placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 justify-end gap-0.5 sm:flex-col sm:justify-start">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          className="inline-flex size-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ArrowUp className="size-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === slots.length - 1}
                          className="inline-flex size-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ArrowDown className="size-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAt(index)}
                          className="inline-flex size-11 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10"
                          aria-label="Remove from workout"
                        >
                          <Trash2 className="size-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {availableToAdd.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Add from library
            </p>
            <div className="flex flex-wrap gap-2">
              {availableToAdd.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => addToWorkout(ex.id)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-zinc-200 hover:border-[var(--color-accent)] hover:text-white"
                >
                  <Plus className="size-4 shrink-0" />
                  <span className="max-w-[14rem] truncate">{ex.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {exercises.length === 0 && (
          <p className="text-sm text-amber-400/90">
            Add at least one exercise in the Exercise library tab first.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="submit"
            className="min-h-12 w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-base font-semibold text-[var(--color-surface)] hover:brightness-110 sm:w-auto sm:text-sm"
          >
            {editingId ? 'Save workout' : 'Create workout'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="min-h-12 w-full rounded-xl border border-[var(--color-border)] px-4 py-3 text-base text-zinc-200 hover:bg-white/5 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {workouts.length === 0 ? (
        <p className="text-sm text-zinc-500">No workouts defined yet.</p>
      ) : (
        <ul className="space-y-2">
          {workouts.map((w) => (
            <li
              key={w.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 text-left"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-white">{w.name}</p>
                  {w.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400 whitespace-pre-wrap">
                      {w.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    {w.exercises.length} exercise
                    {w.exercises.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(w)}
                    className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium text-zinc-200 hover:bg-white/5"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !confirm(
                          `Delete workout “${w.name}”? Scheduled days using it will be cleared.`,
                        )
                      )
                        return
                      try {
                        await removeWorkout(w.id)
                      } catch {
                        /* error surfaced in store */
                      }
                    }}
                    className="min-h-11 rounded-xl border border-red-500/30 px-4 text-sm font-medium text-red-400 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {w.exercises.length > 0 && (
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-zinc-300">
                  {w.exercises.map((slot, idx) => {
                    const label =
                      exerciseById.get(slot.exerciseId)?.name ?? slot.exerciseId
                    const rx = formatPrescription(slot)
                    return (
                      <li key={`${w.id}-${idx}`}>
                        <span className="text-white">{label}</span>
                        {rx ? (
                          <span className="text-zinc-500"> · {rx}</span>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import type {
  DayPlan,
  Exercise,
  WeeklyRule,
  WorkoutExerciseSlot,
  WorkoutTemplate,
} from '../types'

export type ApiUser = { id: number; name: string }

type ApiExerciseRow = {
  id: number
  name: string
  description: string
  youtubeUrl: string
}

type ApiWorkoutExercise = {
  exerciseId: number
  sets: number | null
  reps: string | null
}

type ApiWorkoutRow = {
  id: number
  name: string
  description: string
  exercises: ApiWorkoutExercise[]
}

type ApiScheduleWire = Record<
  string,
  { kind: 'rest' } | { kind: 'workout'; workoutId: number }
>

type ApiWeeklyRuleWire =
  | { dayOfWeek: number; kind: 'rest' }
  | { dayOfWeek: number; kind: 'workout'; workoutId: number }

function mapExercise(row: ApiExerciseRow): Exercise {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    youtubeUrl: row.youtubeUrl,
  }
}

function mapWorkout(row: ApiWorkoutRow): WorkoutTemplate {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    exercises: (row.exercises ?? []).map((e) => ({
      exerciseId: String(e.exerciseId),
      sets: e.sets,
      reps: e.reps,
    })),
  }
}

function exercisesToWire(slots: WorkoutExerciseSlot[]) {
  return slots.map((s) => ({
    exerciseId: Number(s.exerciseId),
    sets: s.sets,
    reps: s.reps,
  }))
}

function mapSchedule(wire: ApiScheduleWire): Record<string, DayPlan> {
  const out: Record<string, DayPlan> = {}
  for (const [iso, v] of Object.entries(wire)) {
    if (v.kind === 'rest') out[iso] = { kind: 'rest' }
    else out[iso] = { kind: 'workout', workoutId: String(v.workoutId) }
  }
  return out
}

function mapWeeklyRules(wire: ApiWeeklyRuleWire[]): WeeklyRule[] {
  return wire.map((r) => {
    if (r.kind === 'rest') {
      return { dayOfWeek: r.dayOfWeek, plan: { kind: 'rest' } }
    }
    return {
      dayOfWeek: r.dayOfWeek,
      plan: { kind: 'workout', workoutId: String(r.workoutId) },
    }
  })
}

function weeklyRulesToWire(rules: WeeklyRule[]): ApiWeeklyRuleWire[] {
  return rules.map((r) => {
    if (r.plan.kind === 'rest') {
      return { dayOfWeek: r.dayOfWeek, kind: 'rest' }
    }
    return {
      dayOfWeek: r.dayOfWeek,
      kind: 'workout',
      workoutId: Number(r.plan.workoutId),
    }
  })
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const j = JSON.parse(text) as { error?: string }
    if (j.error) return j.error
  } catch {
    /* ignore */
  }
  return text || res.statusText
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await parseError(res))
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function listExercises(): Promise<Exercise[]> {
  const res = await fetch('/api/exercises')
  const rows = await json<ApiExerciseRow[]>(res)
  return rows.map(mapExercise)
}

export async function listUsers(): Promise<ApiUser[]> {
  const res = await fetch('/api/users')
  return json<ApiUser[]>(res)
}

export async function createUser(name: string): Promise<ApiUser> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return json<ApiUser>(res)
}

export async function loadUserData(userId: string): Promise<{
  workouts: WorkoutTemplate[]
  schedule: Record<string, DayPlan>
  weeklyRules: WeeklyRule[]
}> {
  const res = await fetch(`/api/users/${userId}/data`)
  const body = await json<{
    workouts: ApiWorkoutRow[]
    schedule: ApiScheduleWire
    weeklyRules?: ApiWeeklyRuleWire[]
  }>(res)
  return {
    workouts: body.workouts.map(mapWorkout),
    schedule: mapSchedule(body.schedule),
    weeklyRules: mapWeeklyRules(body.weeklyRules ?? []),
  }
}

export async function apiPutWeeklyRules(
  userId: string,
  rules: WeeklyRule[],
): Promise<WeeklyRule[]> {
  const res = await fetch(`/api/users/${userId}/weekly-rules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: weeklyRulesToWire(rules) }),
  })
  const body = await json<{ weeklyRules: ApiWeeklyRuleWire[] }>(res)
  return mapWeeklyRules(body.weeklyRules)
}

export async function apiCreateExercise(
  input: Omit<Exercise, 'id'>,
): Promise<Exercise> {
  const res = await fetch('/api/exercises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      youtubeUrl: input.youtubeUrl,
    }),
  })
  const row = await json<ApiExerciseRow>(res)
  return mapExercise(row)
}

export async function apiUpdateExercise(
  id: string,
  patch: Partial<Omit<Exercise, 'id'>>,
): Promise<Exercise> {
  const res = await fetch(`/api/exercises/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const row = await json<ApiExerciseRow>(res)
  return mapExercise(row)
}

export async function apiDeleteExercise(id: string) {
  const res = await fetch(`/api/exercises/${id}`, {
    method: 'DELETE',
  })
  await json<void>(res)
}

export async function apiCreateWorkout(
  userId: string,
  input: Omit<WorkoutTemplate, 'id'>,
): Promise<WorkoutTemplate> {
  const res = await fetch(`/api/users/${userId}/workouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      exercises: exercisesToWire(input.exercises),
    }),
  })
  const row = await json<ApiWorkoutRow>(res)
  return mapWorkout(row)
}

export async function apiUpdateWorkout(
  userId: string,
  id: string,
  patch: Partial<Omit<WorkoutTemplate, 'id'>>,
): Promise<WorkoutTemplate> {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.description !== undefined) body.description = patch.description
  if (patch.exercises !== undefined)
    body.exercises = exercisesToWire(patch.exercises)

  const res = await fetch(`/api/users/${userId}/workouts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const row = await json<ApiWorkoutRow>(res)
  return mapWorkout(row)
}

export async function apiDeleteWorkout(userId: string, id: string) {
  const res = await fetch(`/api/users/${userId}/workouts/${id}`, {
    method: 'DELETE',
  })
  await json<void>(res)
}

export async function apiSetDayPlan(
  userId: string,
  isoDate: string,
  plan: DayPlan,
) {
  const res = await fetch(
    `/api/users/${userId}/schedule/${encodeURIComponent(isoDate)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        plan.kind === 'rest'
          ? { kind: 'rest' }
          : { kind: 'workout', workoutId: Number(plan.workoutId) },
      ),
    },
  )
  await json<unknown>(res)
}

export async function apiClearDayPlan(userId: string, isoDate: string) {
  const res = await fetch(
    `/api/users/${userId}/schedule/${encodeURIComponent(isoDate)}`,
    { method: 'DELETE' },
  )
  await json<void>(res)
}

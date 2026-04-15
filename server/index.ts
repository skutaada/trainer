import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express, { type Request, type Response, type NextFunction } from 'express'
import type Database from 'better-sqlite3'
import { openDatabase } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'
const PORT = Number(process.env.PORT ?? (isProd ? 3000 : 3001))

const db = openDatabase()

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: message })
}

function notFound(res: Response) {
  return res.status(404).json({ error: 'Not found' })
}

function parseId(param: string | undefined): number | null {
  if (param === undefined) return null
  const n = Number(param)
  return Number.isInteger(n) && n > 0 ? n : null
}

function userExists(db: Database.Database, userId: number) {
  const row = db
    .prepare('SELECT 1 FROM users WHERE id = ?')
    .get(userId) as { 1: number } | undefined
  return !!row
}

type WorkoutExerciseWrite = {
  exerciseId: number
  sets: number | null
  reps: string | null
}

function parseExerciseSlots(
  body: Record<string, unknown>,
): { ok: true; slots: WorkoutExerciseWrite[] } | { ok: false; error: string } {
  if (Array.isArray(body.exercises)) {
    const slots: WorkoutExerciseWrite[] = []
    for (const raw of body.exercises) {
      if (!raw || typeof raw !== 'object') {
        return { ok: false, error: 'Each exercise entry must be an object' }
      }
      const o = raw as Record<string, unknown>
      const exerciseId = Number(o.exerciseId)
      if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
        return {
          ok: false,
          error: 'Each exercise needs a positive numeric exerciseId',
        }
      }
      let sets: number | null = null
      if (o.sets !== undefined && o.sets !== null && String(o.sets).trim() !== '') {
        const n = Number(o.sets)
        if (!Number.isInteger(n) || n < 1) {
          return {
            ok: false,
            error: 'sets must be a positive integer when provided',
          }
        }
        sets = n
      }
      let reps: string | null = null
      if (o.reps !== undefined && o.reps !== null) {
        const t = String(o.reps).trim()
        reps = t.length ? t : null
      }
      slots.push({ exerciseId, sets, reps })
    }
    return { ok: true, slots }
  }
  if (Array.isArray(body.exerciseIds)) {
    const ids = (body.exerciseIds as unknown[]).map((x) => Number(x))
    if (!ids.every((n) => Number.isInteger(n) && n > 0)) {
      return { ok: false, error: 'exerciseIds must be positive integers' }
    }
    return {
      ok: true,
      slots: ids.map((exerciseId) => ({ exerciseId, sets: null, reps: null })),
    }
  }
  return { ok: true, slots: [] }
}

function loadWorkoutPayload(workoutId: number) {
  const row = db
    .prepare('SELECT id, name, description FROM workouts WHERE id = ?')
    .get(workoutId) as
    | { id: number; name: string; description: string }
    | undefined
  if (!row) return undefined
  const ex = db
    .prepare(
      `SELECT exercise_id AS exerciseId, sets, reps
       FROM workout_exercises WHERE workout_id = ? ORDER BY sort_order ASC`,
    )
    .all(workoutId) as {
    exerciseId: number
    sets: number | null
    reps: string | null
  }[]
  return {
    ...row,
    exercises: ex.map((r) => ({
      exerciseId: r.exerciseId,
      sets: r.sets,
      reps: r.reps,
    })),
  }
}

// --- users ---

app.get('/api/users', (_req, res) => {
  const rows = db
    .prepare('SELECT id, name FROM users ORDER BY name COLLATE NOCASE ASC')
    .all() as { id: number; name: string }[]
  res.json(rows)
})

app.post('/api/users', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) return badRequest(res, 'Name is required')
  try {
    const info = db.prepare('INSERT INTO users (name) VALUES (?)').run(name)
    res.status(201).json({ id: info.lastInsertRowid, name })
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A user with this name already exists' })
    }
    throw e
  }
})

// --- snapshot ---

app.get('/api/users/:userId/data', (req, res) => {
  const userId = parseId(req.params.userId)
  if (userId === null) return badRequest(res, 'Invalid user id')
  if (!userExists(db, userId)) return notFound(res)

  const workoutsRaw = db
    .prepare(
      `SELECT id, name, description FROM workouts WHERE user_id = ? ORDER BY id ASC`,
    )
    .all(userId) as { id: number; name: string; description: string }[]

  const workoutIds = workoutsRaw.map((w) => w.id)
  const exerciseRowsByWorkout = new Map<
    number,
    { exerciseId: number; sets: number | null; reps: string | null }[]
  >()
  if (workoutIds.length) {
    const placeholders = workoutIds.map(() => '?').join(',')
    const we = db
      .prepare(
        `SELECT workout_id AS workoutId, exercise_id AS exerciseId, sets, reps, sort_order
         FROM workout_exercises WHERE workout_id IN (${placeholders})
         ORDER BY workout_id ASC, sort_order ASC`,
      )
      .all(...workoutIds) as {
      workoutId: number
      exerciseId: number
      sets: number | null
      reps: string | null
      sort_order: number
    }[]
    for (const row of we) {
      const list = exerciseRowsByWorkout.get(row.workoutId) ?? []
      list.push({
        exerciseId: row.exerciseId,
        sets: row.sets,
        reps: row.reps,
      })
      exerciseRowsByWorkout.set(row.workoutId, list)
    }
  }

  const workouts = workoutsRaw.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    exercises: exerciseRowsByWorkout.get(w.id) ?? [],
  }))

  const dayRows = db
    .prepare(
      `SELECT iso_date AS isoDate, kind, workout_id AS workoutId
       FROM day_plans WHERE user_id = ?`,
    )
    .all(userId) as {
    isoDate: string
    kind: 'rest' | 'workout'
    workoutId: number | null
  }[]

  const schedule: Record<
    string,
    { kind: 'rest' } | { kind: 'workout'; workoutId: number }
  > = {}
  for (const d of dayRows) {
    if (d.kind === 'rest') {
      schedule[d.isoDate] = { kind: 'rest' }
    } else if (d.workoutId != null) {
      schedule[d.isoDate] = { kind: 'workout', workoutId: d.workoutId }
    }
  }

  const weeklyRows = db
    .prepare(
      `SELECT day_of_week AS dayOfWeek, kind, workout_id AS workoutId
       FROM weekly_rules WHERE user_id = ? ORDER BY day_of_week ASC`,
    )
    .all(userId) as {
    dayOfWeek: number
    kind: 'rest' | 'workout'
    workoutId: number | null
  }[]

  const weeklyRules = weeklyRows
    .filter(
      (r) =>
        r.kind === 'rest' ||
        (r.kind === 'workout' &&
          r.workoutId != null &&
          workoutIds.includes(r.workoutId)),
    )
    .map((r) => {
      if (r.kind === 'rest') {
        return { dayOfWeek: r.dayOfWeek, kind: 'rest' as const }
      }
      return {
        dayOfWeek: r.dayOfWeek,
        kind: 'workout' as const,
        workoutId: r.workoutId!,
      }
    })

  res.json({ workouts, schedule, weeklyRules })
})

// --- weekly repeating pattern (per weekday) ---

app.put('/api/users/:userId/weekly-rules', (req, res) => {
  const userId = parseId(req.params.userId)
  if (userId === null) return badRequest(res, 'Invalid user id')
  if (!userExists(db, userId)) return notFound(res)

  const rules = req.body?.rules
  if (!Array.isArray(rules)) {
    return badRequest(res, 'rules must be an array')
  }

  const normalized: {
    dayOfWeek: number
    kind: 'rest' | 'workout'
    workoutId: number | null
  }[] = []

  for (const raw of rules) {
    if (!raw || typeof raw !== 'object') {
      return badRequest(res, 'Each rule must be an object')
    }
    const o = raw as Record<string, unknown>
    const dayOfWeek = Number(o.dayOfWeek)
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return badRequest(res, 'dayOfWeek must be 0–6 (Mon–Sun)')
    }
    const kind = o.kind
    if (kind !== 'rest' && kind !== 'workout') {
      return badRequest(res, 'kind must be rest or workout')
    }
    let workoutId: number | null = null
    if (kind === 'workout') {
      const wid = parseId(String(o.workoutId))
      if (wid === null) {
        return badRequest(res, 'workoutId required for workout rules')
      }
      const ok = db
        .prepare('SELECT 1 FROM workouts WHERE id = ? AND user_id = ?')
        .get(wid, userId) as { 1: number } | undefined
      if (!ok) return badRequest(res, 'Unknown workout')
      workoutId = wid
    }
    normalized.push({ dayOfWeek, kind, workoutId })
  }

  const seen = new Set<number>()
  for (const r of normalized) {
    if (seen.has(r.dayOfWeek)) {
      return badRequest(res, 'Duplicate dayOfWeek in rules')
    }
    seen.add(r.dayOfWeek)
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM weekly_rules WHERE user_id = ?').run(userId)
    const ins = db.prepare(
      `INSERT INTO weekly_rules (user_id, day_of_week, kind, workout_id)
       VALUES (?, ?, ?, ?)`,
    )
    for (const r of normalized) {
      ins.run(userId, r.dayOfWeek, r.kind, r.workoutId)
    }
  })
  tx()

  const weeklyRows = db
    .prepare(
      `SELECT day_of_week AS dayOfWeek, kind, workout_id AS workoutId
       FROM weekly_rules WHERE user_id = ? ORDER BY day_of_week ASC`,
    )
    .all(userId) as {
    dayOfWeek: number
    kind: 'rest' | 'workout'
    workoutId: number | null
  }[]

  const workoutIdSet = new Set(
    (
      db
        .prepare('SELECT id FROM workouts WHERE user_id = ?')
        .all(userId) as { id: number }[]
    ).map((r) => r.id),
  )

  const weeklyRules = weeklyRows
    .filter(
      (r) =>
        r.kind === 'rest' ||
        (r.kind === 'workout' &&
          r.workoutId != null &&
          workoutIdSet.has(r.workoutId)),
    )
    .map((r) => {
      if (r.kind === 'rest') {
        return { dayOfWeek: r.dayOfWeek, kind: 'rest' as const }
      }
      return {
        dayOfWeek: r.dayOfWeek,
        kind: 'workout' as const,
        workoutId: r.workoutId!,
      }
    })

  res.json({ weeklyRules })
})

// --- shared exercise library ---

app.get('/api/exercises', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, description, youtube_url AS youtubeUrl
       FROM exercises ORDER BY id ASC`,
    )
    .all() as {
    id: number
    name: string
    description: string
    youtubeUrl: string
  }[]
  res.json(rows)
})

app.post('/api/exercises', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) return badRequest(res, 'Name is required')
  const description = String(req.body?.description ?? '')
  const youtubeUrl = String(req.body?.youtubeUrl ?? '')

  const info = db
    .prepare(
      `INSERT INTO exercises (name, description, youtube_url)
       VALUES (?, ?, ?)`,
    )
    .run(name, description, youtubeUrl)

  const row = db
    .prepare(
      `SELECT id, name, description, youtube_url AS youtubeUrl
       FROM exercises WHERE id = ?`,
    )
    .get(info.lastInsertRowid) as {
    id: number
    name: string
    description: string
    youtubeUrl: string
  }
  res.status(201).json(row)
})

app.patch('/api/exercises/:exerciseId', (req, res) => {
  const exerciseId = parseId(req.params.exerciseId)
  if (exerciseId === null) return badRequest(res, 'Invalid id')

  const existing = db
    .prepare('SELECT id FROM exercises WHERE id = ?')
    .get(exerciseId) as { id: number } | undefined
  if (!existing) return notFound(res)

  const name =
    req.body?.name !== undefined
      ? String(req.body.name).trim()
      : undefined
  const description =
    req.body?.description !== undefined
      ? String(req.body.description)
      : undefined
  const youtubeUrl =
    req.body?.youtubeUrl !== undefined
      ? String(req.body.youtubeUrl)
      : undefined

  if (name !== undefined && !name) return badRequest(res, 'Name cannot be empty')

  const fields: string[] = []
  const values: (string | number)[] = []
  if (name !== undefined) {
    fields.push('name = ?')
    values.push(name)
  }
  if (description !== undefined) {
    fields.push('description = ?')
    values.push(description)
  }
  if (youtubeUrl !== undefined) {
    fields.push('youtube_url = ?')
    values.push(youtubeUrl)
  }
  if (!fields.length) return badRequest(res, 'No fields to update')

  values.push(exerciseId)
  db.prepare(
    `UPDATE exercises SET ${fields.join(', ')} WHERE id = ?`,
  ).run(...values)

  const row = db
    .prepare(
      `SELECT id, name, description, youtube_url AS youtubeUrl
       FROM exercises WHERE id = ?`,
    )
    .get(exerciseId) as {
    id: number
    name: string
    description: string
    youtubeUrl: string
  }
  res.json(row)
})

app.delete('/api/exercises/:exerciseId', (req, res) => {
  const exerciseId = parseId(req.params.exerciseId)
  if (exerciseId === null) return badRequest(res, 'Invalid id')

  const info = db.prepare('DELETE FROM exercises WHERE id = ?').run(exerciseId)
  if (info.changes === 0) return notFound(res)
  res.status(204).end()
})

// --- workouts ---

app.post('/api/users/:userId/workouts', (req, res) => {
  const userId = parseId(req.params.userId)
  if (userId === null) return badRequest(res, 'Invalid user id')
  if (!userExists(db, userId)) return notFound(res)

  const name = String(req.body?.name ?? '').trim()
  if (!name) return badRequest(res, 'Name is required')
  const description = String(req.body?.description ?? '')

  const parsed = parseExerciseSlots(req.body as Record<string, unknown>)
  if (!parsed.ok) return badRequest(res, parsed.error)
  const slots = parsed.slots

  const tx = db.transaction(() => {
    const w = db
      .prepare(
        `INSERT INTO workouts (user_id, name, description) VALUES (?, ?, ?)`,
      )
      .run(userId, name, description)
    const workoutId = Number(w.lastInsertRowid)

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const ok = db
        .prepare('SELECT 1 FROM exercises WHERE id = ?')
        .get(slot.exerciseId) as { 1: number } | undefined
      if (!ok) throw new Error(`Unknown exercise id: ${slot.exerciseId}`)
      db.prepare(
        `INSERT INTO workout_exercises (workout_id, exercise_id, sort_order, sets, reps)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(workoutId, slot.exerciseId, i, slot.sets, slot.reps)
    }
    return workoutId
  })

  let workoutId: number
  try {
    workoutId = tx()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith('Unknown exercise')) {
      return badRequest(res, msg)
    }
    throw e
  }

  const payload = loadWorkoutPayload(workoutId)
  res.status(201).json(payload)
})

app.patch('/api/users/:userId/workouts/:workoutId', (req, res) => {
  const userId = parseId(req.params.userId)
  const workoutId = parseId(req.params.workoutId)
  if (userId === null || workoutId === null)
    return badRequest(res, 'Invalid id')
  if (!userExists(db, userId)) return notFound(res)

  const existing = db
    .prepare('SELECT id FROM workouts WHERE id = ? AND user_id = ?')
    .get(workoutId, userId) as { id: number } | undefined
  if (!existing) return notFound(res)

  const name =
    req.body?.name !== undefined
      ? String(req.body.name).trim()
      : undefined
  const description =
    req.body?.description !== undefined
      ? String(req.body.description)
      : undefined
  const body = req.body as Record<string, unknown>
  const replaceExercises =
    body.exercises !== undefined || body.exerciseIds !== undefined

  if (name !== undefined && !name) return badRequest(res, 'Name cannot be empty')

  let parsedSlots: WorkoutExerciseWrite[] | null = null
  if (replaceExercises) {
    const parsed = parseExerciseSlots(body)
    if (!parsed.ok) return badRequest(res, parsed.error)
    parsedSlots = parsed.slots
  }

  const tx = db.transaction(() => {
    if (name !== undefined || description !== undefined) {
      const sqlParts: string[] = []
      const vals: (string | number)[] = []
      if (name !== undefined) {
        sqlParts.push('name = ?')
        vals.push(name)
      }
      if (description !== undefined) {
        sqlParts.push('description = ?')
        vals.push(description)
      }
      vals.push(workoutId, userId)
      db.prepare(
        `UPDATE workouts SET ${sqlParts.join(', ')} WHERE id = ? AND user_id = ?`,
      ).run(...vals)
    }

    if (parsedSlots !== null) {
      for (const slot of parsedSlots) {
        const ok = db
          .prepare('SELECT 1 FROM exercises WHERE id = ?')
          .get(slot.exerciseId) as { 1: number } | undefined
        if (!ok) throw new Error(`Unknown exercise id: ${slot.exerciseId}`)
      }
      db.prepare('DELETE FROM workout_exercises WHERE workout_id = ?').run(
        workoutId,
      )
      for (let i = 0; i < parsedSlots.length; i++) {
        const slot = parsedSlots[i]
        db.prepare(
          `INSERT INTO workout_exercises (workout_id, exercise_id, sort_order, sets, reps)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(workoutId, slot.exerciseId, i, slot.sets, slot.reps)
      }
    }
  })

  try {
    tx()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith('Unknown exercise')) {
      return badRequest(res, msg)
    }
    throw e
  }

  const payload = loadWorkoutPayload(workoutId)
  res.json(payload)
})

app.delete('/api/users/:userId/workouts/:workoutId', (req, res) => {
  const userId = parseId(req.params.userId)
  const workoutId = parseId(req.params.workoutId)
  if (userId === null || workoutId === null)
    return badRequest(res, 'Invalid id')
  if (!userExists(db, userId)) return notFound(res)

  db.prepare(
    `UPDATE weekly_rules SET kind = 'rest', workout_id = NULL
     WHERE user_id = ? AND workout_id = ?`,
  ).run(userId, workoutId)

  const info = db
    .prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?')
    .run(workoutId, userId)
  if (info.changes === 0) return notFound(res)
  res.status(204).end()
})

// --- schedule ---

app.put('/api/users/:userId/schedule/:isoDate', (req, res) => {
  const userId = parseId(req.params.userId)
  if (userId === null) return badRequest(res, 'Invalid user id')
  if (!userExists(db, userId)) return notFound(res)

  const isoDate = String(req.params.isoDate ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return badRequest(res, 'isoDate must be yyyy-MM-dd')
  }

  const kind = req.body?.kind
  if (kind !== 'rest' && kind !== 'workout') {
    return badRequest(res, 'kind must be rest or workout')
  }

  let workoutId: number | null = null
  if (kind === 'workout') {
    const wid = parseId(String(req.body?.workoutId))
    if (wid === null) return badRequest(res, 'workoutId required for workout days')
    const ok = db
      .prepare('SELECT 1 FROM workouts WHERE id = ? AND user_id = ?')
      .get(wid, userId) as { 1: number } | undefined
    if (!ok) return badRequest(res, 'Unknown workout')
    workoutId = wid
  }

  db.prepare(
    `INSERT INTO day_plans (user_id, iso_date, kind, workout_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, iso_date) DO UPDATE SET
       kind = excluded.kind,
       workout_id = excluded.workout_id`,
  ).run(userId, isoDate, kind, workoutId)

  if (kind === 'rest') {
    return res.json({ isoDate, kind: 'rest' as const })
  }
  return res.json({
    isoDate,
    kind: 'workout' as const,
    workoutId: workoutId!,
  })
})

app.delete('/api/users/:userId/schedule/:isoDate', (req, res) => {
  const userId = parseId(req.params.userId)
  if (userId === null) return badRequest(res, 'Invalid user id')
  if (!userExists(db, userId)) return notFound(res)

  const isoDate = String(req.params.isoDate ?? '')
  db.prepare('DELETE FROM day_plans WHERE user_id = ? AND iso_date = ?').run(
    userId,
    isoDate,
  )
  res.status(204).end()
})

// --- static (production) ---

if (isProd) {
  const dist = path.join(__dirname, '..', 'dist')
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  void next
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(
    `[trainer] API ${isProd ? '+ static' : ''} on http://127.0.0.1:${PORT}`,
  )
})

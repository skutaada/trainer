import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const defaultPath = path.join(process.cwd(), 'data', 'trainer.db')

export function openDatabase(filePath = process.env.SQLITE_PATH ?? defaultPath) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function tableExists(db: InstanceType<typeof Database>, name: string) {
  const row = db
    .prepare(
      `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    )
    .get(name) as { 1: number } | undefined
  return !!row
}

function exercisesHasUserIdColumn(db: InstanceType<typeof Database>) {
  const cols = db.prepare(`PRAGMA table_info(exercises)`).all() as {
    name: string
  }[]
  return cols.some((c) => c.name === 'user_id')
}

/** Move from per-user exercises to a single shared library (keeps ids). */
function migrateExercisesToShared(db: InstanceType<typeof Database>) {
  if (!tableExists(db, 'exercises')) {
    db.exec(`
      CREATE TABLE exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        youtube_url TEXT NOT NULL DEFAULT ''
      );
    `)
    return
  }

  if (!exercisesHasUserIdColumn(db)) return

  db.pragma('foreign_keys = OFF')
  try {
    db.transaction(() => {
      db.exec(`DROP INDEX IF EXISTS idx_exercises_user`)
      db.exec(`
        CREATE TABLE exercises__shared (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          youtube_url TEXT NOT NULL DEFAULT ''
        );
        INSERT INTO exercises__shared (id, name, description, youtube_url)
          SELECT id, name, description, youtube_url FROM exercises;
        DROP TABLE exercises;
        ALTER TABLE exercises__shared RENAME TO exercises;
      `)
    })()
  } finally {
    db.pragma('foreign_keys = ON')
  }
}

function workoutExercisesHasSetsColumn(db: InstanceType<typeof Database>) {
  const cols = db.prepare(`PRAGMA table_info(workout_exercises)`).all() as {
    name: string
  }[]
  return cols.some((c) => c.name === 'sets')
}

function migrateWorkoutExerciseSetsReps(db: InstanceType<typeof Database>) {
  if (!tableExists(db, 'workout_exercises')) return
  if (workoutExercisesHasSetsColumn(db)) return
  db.exec(`
    ALTER TABLE workout_exercises ADD COLUMN sets INTEGER;
    ALTER TABLE workout_exercises ADD COLUMN reps TEXT;
  `)
}

function dayPlansHasCompletedColumn(db: InstanceType<typeof Database>) {
  const cols = db.prepare(`PRAGMA table_info(day_plans)`).all() as {
    name: string
  }[]
  return cols.some((c) => c.name === 'completed')
}

/** Track whether the user marked the day done (heatmap uses this). */
function migrateDayPlansCompleted(db: InstanceType<typeof Database>) {
  if (!tableExists(db, 'day_plans')) return
  if (dayPlansHasCompletedColumn(db)) return
  db.exec(`
    ALTER TABLE day_plans ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;
    UPDATE day_plans SET completed = 1;
  `)
}

function migrate(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );
  `)

  migrateExercisesToShared(db)

  db.exec(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);

    CREATE TABLE IF NOT EXISTS workout_exercises (
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      UNIQUE (workout_id, sort_order)
    );
    CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id);

    CREATE TABLE IF NOT EXISTS day_plans (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      iso_date TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('rest', 'workout')),
      workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
      completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
      PRIMARY KEY (user_id, iso_date)
    );

    CREATE TABLE IF NOT EXISTS weekly_rules (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
      kind TEXT NOT NULL CHECK (kind IN ('rest', 'workout')),
      workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
      PRIMARY KEY (user_id, day_of_week)
    );
  `)

  migrateWorkoutExerciseSetsReps(db)
  migrateDayPlansCompleted(db)
}

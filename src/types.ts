export type Exercise = {
  id: string
  name: string
  description: string
  youtubeUrl: string
}

/** One exercise inside a workout template, with optional prescription. */
export type WorkoutExerciseSlot = {
  exerciseId: string
  sets: number | null
  reps: string | null
}

export type WorkoutTemplate = {
  id: string
  name: string
  description: string
  exercises: WorkoutExerciseSlot[]
}

export type DayPlan =
  | { kind: 'rest' }
  | { kind: 'workout'; workoutId: string }

/** 0 = Monday … 6 = Sunday (same as calendar grid). */
export type WeeklyRule = {
  dayOfWeek: number
  plan: DayPlan
}

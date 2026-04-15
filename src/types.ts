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

/** Assigned on the calendar (explicit day); `completed` gates the activity heatmap. */
export type DayPlan =
  | { kind: 'rest'; completed: boolean }
  | { kind: 'workout'; workoutId: string; completed: boolean }

/** Weekly rhythm rows (no completion — only explicit days count on the heatmap). */
export type WeekdayPlan =
  | { kind: 'rest' }
  | { kind: 'workout'; workoutId: string }

/** 0 = Monday … 6 = Sunday (same as calendar grid). */
export type WeeklyRule = {
  dayOfWeek: number
  plan: WeekdayPlan
}

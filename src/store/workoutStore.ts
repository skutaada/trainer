import { create } from 'zustand'
import type { DayPlan, Exercise, WeeklyRule, WorkoutTemplate } from '../types'
import * as api from '../api/client'

const USER_STORAGE_KEY = 'trainer-current-user-id'

export type PlannerUser = { id: string; name: string }

type WorkoutStore = {
  users: PlannerUser[]
  currentUserId: string | null
  exercises: Exercise[]
  workouts: WorkoutTemplate[]
  schedule: Record<string, DayPlan>
  weeklyRules: WeeklyRule[]
  loading: boolean
  error: string | null

  clearError: () => void
  bootstrap: () => Promise<void>
  selectUser: (userId: string) => Promise<void>
  createUser: (name: string) => Promise<void>

  addExercise: (input: Omit<Exercise, 'id'>) => Promise<string>
  updateExercise: (
    id: string,
    patch: Partial<Omit<Exercise, 'id'>>,
  ) => Promise<void>
  removeExercise: (id: string) => Promise<void>

  addWorkout: (input: Omit<WorkoutTemplate, 'id'>) => Promise<string>
  updateWorkout: (
    id: string,
    patch: Partial<Omit<WorkoutTemplate, 'id'>>,
  ) => Promise<void>
  removeWorkout: (id: string) => Promise<void>

  setDayPlan: (isoDate: string, plan: DayPlan | null) => Promise<void>
  saveWeeklyRules: (rules: WeeklyRule[]) => Promise<void>
}

function mapApiUser(u: api.ApiUser): PlannerUser {
  return { id: String(u.id), name: u.name }
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  users: [],
  currentUserId: null,
  exercises: [],
  workouts: [],
  schedule: {},
  weeklyRules: [],
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  bootstrap: async () => {
    set({ loading: true, error: null })
    try {
      const [rawUsers, exercises] = await Promise.all([
        api.listUsers(),
        api.listExercises(),
      ])
      const users = rawUsers.map(mapApiUser)
      set({ users, exercises })
      const stored = localStorage.getItem(USER_STORAGE_KEY)
      const match = stored && users.some((u) => u.id === stored)
      if (match && stored) {
        await get().selectUser(stored)
      } else {
        if (stored) localStorage.removeItem(USER_STORAGE_KEY)
        set({
          currentUserId: null,
          workouts: [],
          schedule: {},
          weeklyRules: [],
          loading: false,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({
        loading: false,
        error: msg,
        users: [],
        currentUserId: null,
        exercises: [],
        workouts: [],
        schedule: {},
        weeklyRules: [],
      })
    }
  },

  selectUser: async (userId: string) => {
    const prev = get().currentUserId
    set({
      loading: true,
      error: null,
      ...(userId !== prev ? { workouts: [], schedule: {}, weeklyRules: [] } : {}),
    })
    try {
      const data = await api.loadUserData(userId)
      localStorage.setItem(USER_STORAGE_KEY, userId)
      set({
        currentUserId: userId,
        workouts: data.workouts,
        schedule: data.schedule,
        weeklyRules: data.weeklyRules,
        loading: false,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'Not found') localStorage.removeItem(USER_STORAGE_KEY)
      const exercises = get().exercises
      set({
        loading: false,
        error: msg,
        currentUserId: null,
        exercises,
        workouts: [],
        schedule: {},
        weeklyRules: [],
      })
    }
  },

  createUser: async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    set({ loading: true, error: null })
    try {
      const created = await api.createUser(trimmed)
      const u = mapApiUser(created)
      set((s) => ({
        users: [...s.users, u].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        ),
      }))
      await get().selectUser(u.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ loading: false, error: msg })
    }
  },

  addExercise: async (input) => {
    set({ error: null })
    try {
      const ex = await api.apiCreateExercise(input)
      set((s) => ({ exercises: [...s.exercises, ex] }))
      return ex.id
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg })
      throw e
    }
  },

  updateExercise: async (id, patch) => {
    set({ error: null })
    try {
      const ex = await api.apiUpdateExercise(id, patch)
      set((s) => ({
        exercises: s.exercises.map((e) => (e.id === id ? ex : e)),
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg })
      throw e
    }
  },

  removeExercise: async (id) => {
    set({ error: null })
    try {
      await api.apiDeleteExercise(id)
      set((s) => ({
        exercises: s.exercises.filter((e) => e.id !== id),
        workouts: s.workouts.map((w) => ({
          ...w,
          exercises: w.exercises.filter((x) => x.exerciseId !== id),
        })),
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg })
      throw e
    }
  },

  addWorkout: async (input) => {
    const uid = get().currentUserId
    if (!uid) {
      set({ error: 'Select a user first' })
      throw new Error('Select a user first')
    }
    set({ error: null })
    try {
      const w = await api.apiCreateWorkout(uid, input)
      set((s) => ({ workouts: [...s.workouts, w] }))
      return w.id
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg })
      throw e
    }
  },

  updateWorkout: async (id, patch) => {
    const uid = get().currentUserId
    if (!uid) {
      set({ error: 'Select a user first' })
      throw new Error('Select a user first')
    }
    set({ error: null })
    try {
      const w = await api.apiUpdateWorkout(uid, id, patch)
      set((s) => ({
        workouts: s.workouts.map((x) => (x.id === id ? w : x)),
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg })
      throw e
    }
  },

  removeWorkout: async (id) => {
    const uid = get().currentUserId
    if (!uid) {
      set({ error: 'Select a user first' })
      throw new Error('Select a user first')
    }
    set({ error: null })
    try {
      await api.apiDeleteWorkout(uid, id)
      set((s) => {
        const schedule = { ...s.schedule }
        for (const key of Object.keys(schedule)) {
          const p = schedule[key]
          if (p?.kind === 'workout' && p.workoutId === id) {
            delete schedule[key]
          }
        }
        const weeklyRules = s.weeklyRules.map((r) =>
          r.plan.kind === 'workout' && r.plan.workoutId === id
            ? { dayOfWeek: r.dayOfWeek, plan: { kind: 'rest' as const } }
            : r,
        )
        return {
          workouts: s.workouts.filter((w) => w.id !== id),
          schedule,
          weeklyRules,
        }
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg })
      throw e
    }
  },

  setDayPlan: async (isoDate, plan) => {
    const uid = get().currentUserId
    if (!uid) {
      set({ error: 'Select a user first' })
      throw new Error('Select a user first')
    }
    set({ error: null })
    try {
      if (plan === null) {
        await api.apiClearDayPlan(uid, isoDate)
        set((s) => {
          const schedule = { ...s.schedule }
          delete schedule[isoDate]
          return { schedule }
        })
        return
      }
      await api.apiSetDayPlan(uid, isoDate, plan)
      set((s) => ({
        schedule: { ...s.schedule, [isoDate]: plan },
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg })
      throw e
    }
  },

  saveWeeklyRules: async (rules) => {
    const uid = get().currentUserId
    if (!uid) {
      set({ error: 'Select a user first' })
      throw new Error('Select a user first')
    }
    set({ error: null })
    try {
      const weeklyRules = await api.apiPutWeeklyRules(uid, rules)
      set({ weeklyRules })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg })
      throw e
    }
  },
}))

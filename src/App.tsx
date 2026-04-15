import { useEffect, useState, type FormEvent } from 'react'
import { Activity, CalendarDays, Dumbbell, Layers3 } from 'lucide-react'
import { ActivityHeatmap } from './components/ActivityHeatmap'
import { ExerciseLibrary } from './components/ExerciseLibrary'
import { MonthCalendar } from './components/MonthCalendar'
import { WorkoutBuilder } from './components/WorkoutBuilder'
import { useWorkoutStore, type PlannerUser } from './store/workoutStore'

type Tab = 'exercises' | 'activity' | 'workouts' | 'calendar'

const tabs: {
  id: Tab
  label: string
  shortLabel: string
  icon: typeof Dumbbell
}[] = [
  { id: 'exercises', label: 'Exercises', shortLabel: 'Exercises', icon: Dumbbell },
  {
    id: 'activity',
    label: 'Heatmap',
    shortLabel: 'Heat',
    icon: Activity,
  },
  { id: 'workouts', label: 'Workouts', shortLabel: 'Workouts', icon: Layers3 },
  {
    id: 'calendar',
    label: 'Month plan',
    shortLabel: 'Calendar',
    icon: CalendarDays,
  },
]

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  shortLabel,
  variant,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Dumbbell
  label: string
  shortLabel: string
  variant: 'bar' | 'inline'
}) {
  if (variant === 'bar') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          'flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[11px] font-semibold leading-snug',
          active
            ? 'bg-[var(--color-accent)] text-[var(--color-surface)]'
            : 'text-zinc-300 active:bg-white/10',
        ].join(' ')}
      >
        <Icon className="size-6 shrink-0" aria-hidden />
        <span className="line-clamp-2 break-words hyphens-auto px-0.5">
          {shortLabel}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
        active
          ? 'bg-[var(--color-accent)] text-[var(--color-surface)]'
          : 'border border-[var(--color-border)] text-zinc-200 hover:bg-white/5',
      ].join(' ')}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

function UserPickScreen({
  users,
  loading,
  onSelect,
  onCreate,
}: {
  users: PlannerUser[]
  loading: boolean
  onSelect: (id: string) => void
  onCreate: (name: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const t = name.trim()
    if (!t) return
    setBusy(true)
    try {
      await onCreate(t)
      setName('')
    } catch {
      /* store */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white">
          Who is this for?
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">
          Choose a profile or add a name. Shared exercises; workouts and calendar
          are per person.
        </p>
      </div>

      {users.length > 0 ? (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                disabled={loading}
                onClick={() => onSelect(u.id)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3 text-left text-base font-medium text-white hover:border-[var(--color-accent)]/40 disabled:opacity-50"
              >
                {u.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={submit} className="space-y-2">
        <label className="sr-only" htmlFor="new-user-name">
          New name
        </label>
        <input
          id="new-user-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={users.length ? 'Or add someone new…' : 'Your name…'}
          className="w-full min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        />
        <button
          type="submit"
          disabled={loading || busy || !name.trim()}
          className="w-full min-h-12 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-[var(--color-surface)] hover:brightness-110 disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Add and continue'}
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('exercises')

  const bootstrap = useWorkoutStore((s) => s.bootstrap)
  const loading = useWorkoutStore((s) => s.loading)
  const error = useWorkoutStore((s) => s.error)
  const clearError = useWorkoutStore((s) => s.clearError)
  const users = useWorkoutStore((s) => s.users)
  const currentUserId = useWorkoutStore((s) => s.currentUserId)
  const selectUser = useWorkoutStore((s) => s.selectUser)
  const createUser = useWorkoutStore((s) => s.createUser)
  const exitUser = useWorkoutStore((s) => s.exitUser)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const currentName = users.find((u) => u.id === currentUserId)?.name
  const initialLoad = loading && users.length === 0 && !error
  const inSession = !!currentUserId

  return (
    <div className="min-h-dvh min-h-svh flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]/90 backdrop-blur-md sticky top-0 z-40 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pb-4 sm:gap-4 sm:pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
                Trainer
              </p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-white sm:text-2xl">
                Workout planner
              </h1>
              {inSession ? (
                <p className="mt-2 text-sm text-zinc-400">
                  Workouts and calendar for{' '}
                  <span className="font-medium text-white">{currentName}</span>
                  <span className="text-zinc-600"> · </span>
                  <button
                    type="button"
                    onClick={() => {
                      exitUser()
                      setTab('exercises')
                    }}
                    className="font-medium text-[var(--color-accent)] hover:underline"
                  >
                    Switch user
                  </button>
                </p>
              ) : (
                <p className="mt-1 hidden text-sm text-zinc-400 sm:max-w-md md:block">
                  Shared exercise library; each profile has its own workouts and
                  calendar. Names only—no passwords.
                </p>
              )}
            </div>
            {inSession ? (
              <nav
                className="hidden flex-wrap gap-2 sm:justify-end md:flex"
                aria-label="Primary (desktop)"
              >
                {tabs.map(({ id, label, shortLabel, icon }) => (
                  <TabButton
                    key={id}
                    active={tab === id}
                    onClick={() => setTab(id)}
                    icon={icon}
                    label={label}
                    shortLabel={shortLabel}
                    variant="inline"
                  />
                ))}
              </nav>
            ) : null}
          </div>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="mx-auto mt-3 flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        >
          <span className="min-w-0 break-words">{error}</span>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void bootstrap()}
              className="min-h-11 flex-1 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/15 sm:flex-none sm:py-1.5 sm:text-xs"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={clearError}
              className="min-h-11 flex-1 rounded-lg border border-red-500/30 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/5 sm:flex-none sm:py-1.5 sm:text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <main
        className={[
          'mx-auto w-full max-w-3xl flex-1 px-4 py-5 pt-5 md:py-8',
          inSession
            ? 'pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-8'
            : 'pb-8',
        ].join(' ')}
      >
        {initialLoad ? (
          <p className="text-center text-base text-zinc-500">Loading…</p>
        ) : !inSession ? (
          <div className="space-y-12">
            <UserPickScreen
              users={users}
              loading={loading}
              onSelect={(id) => void selectUser(id)}
              onCreate={(name) => createUser(name)}
            />
            <ActivityHeatmap />
          </div>
        ) : (
          <>
            {tab === 'exercises' && <ExerciseLibrary />}
            {tab === 'activity' && <ActivityHeatmap />}
            {tab === 'workouts' && <WorkoutBuilder />}
            {tab === 'calendar' && <MonthCalendar />}
          </>
        )}
      </main>

      {inSession ? (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)]/95 backdrop-blur-md pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] md:hidden"
          aria-label="Primary"
        >
          <div className="mx-auto flex max-w-lg gap-1 px-1">
            {tabs.map(({ id, label, shortLabel, icon }) => (
              <TabButton
                key={id}
                active={tab === id}
                onClick={() => setTab(id)}
                icon={icon}
                label={label}
                shortLabel={shortLabel}
                variant="bar"
              />
            ))}
          </div>
        </nav>
      ) : null}

      <footer className="hidden border-t border-[var(--color-border)] py-6 text-center text-xs text-zinc-600 md:block">
        SQLite file in <code className="text-zinc-500">data/trainer.db</code>.
        Dev: run{' '}
        <code className="text-zinc-500">npm run dev:all</code> (API + Vite).
        Production: <code className="text-zinc-500">npm run build</code> then{' '}
        <code className="text-zinc-500">npm start</code>. Docker:{' '}
        <code className="text-zinc-500">docker compose up</code>.
      </footer>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { CalendarDays, Dumbbell, Layers3, UserPlus } from 'lucide-react'
import { ExerciseLibrary } from './components/ExerciseLibrary'
import { MonthCalendar } from './components/MonthCalendar'
import { Modal } from './components/Modal'
import { WorkoutBuilder } from './components/WorkoutBuilder'
import { useWorkoutStore } from './store/workoutStore'

type Tab = 'exercises' | 'workouts' | 'calendar'

const tabs: {
  id: Tab
  label: string
  shortLabel: string
  icon: typeof Dumbbell
}[] = [
  { id: 'exercises', label: 'Exercises', shortLabel: 'Exercises', icon: Dumbbell },
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
  disabled,
  onClick,
  icon: Icon,
  label,
  shortLabel,
  variant,
}: {
  active: boolean
  disabled: boolean
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
        disabled={disabled}
        className={[
          'flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center text-[11px] font-semibold leading-snug',
          active
            ? 'bg-[var(--color-accent)] text-[var(--color-surface)]'
            : 'text-zinc-300 active:bg-white/10',
          disabled ? 'opacity-40 pointer-events-none' : '',
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
      disabled={disabled}
      className={[
        'inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
        active
          ? 'bg-[var(--color-accent)] text-[var(--color-surface)]'
          : 'border border-[var(--color-border)] text-zinc-200 hover:bg-white/5',
        disabled ? 'opacity-40 pointer-events-none' : '',
      ].join(' ')}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('exercises')
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [newUserName, setNewUserName] = useState('')

  const bootstrap = useWorkoutStore((s) => s.bootstrap)
  const loading = useWorkoutStore((s) => s.loading)
  const error = useWorkoutStore((s) => s.error)
  const clearError = useWorkoutStore((s) => s.clearError)
  const users = useWorkoutStore((s) => s.users)
  const currentUserId = useWorkoutStore((s) => s.currentUserId)
  const selectUser = useWorkoutStore((s) => s.selectUser)
  const createUser = useWorkoutStore((s) => s.createUser)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const currentName = users.find((u) => u.id === currentUserId)?.name

  const submitNewUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserName.trim()) return
    try {
      await createUser(newUserName)
      setNewUserName('')
      setAddUserOpen(false)
    } catch {
      /* error surfaced in store */
    }
  }

  const initialLoad = loading && users.length === 0 && !error

  const planGate = (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 sm:p-8 text-center text-sm text-zinc-400">
      <p className="text-white font-medium text-base">Select a user</p>
      <p className="mt-2 leading-relaxed">
        Workout templates and the month calendar are personal. Choose someone
        above to edit their plan.
      </p>
    </div>
  )

  return (
    <div className="min-h-dvh min-h-svh flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]/90 backdrop-blur-md sticky top-0 z-40 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pb-4 sm:gap-4 sm:pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-left min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
                Trainer
              </p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-white sm:text-2xl">
                Workout planner
              </h1>
              <p className="mt-1 hidden text-sm text-zinc-400 sm:max-w-md md:block">
                One shared exercise library for everyone; each user has their own
                workouts and calendar in SQLite. Names only—no passwords—so use
                this only on networks you trust.
              </p>
            </div>
            <nav
              className="hidden flex-wrap gap-2 sm:justify-end md:flex"
              aria-label="Primary (desktop)"
            >
              {tabs.map(({ id, label, shortLabel, icon }) => {
                const needsProfile =
                  id !== 'exercises' && !currentUserId && !initialLoad
                return (
                  <TabButton
                    key={id}
                    active={tab === id}
                    disabled={needsProfile}
                    onClick={() => setTab(id)}
                    icon={icon}
                    label={label}
                    shortLabel={shortLabel}
                    variant="inline"
                  />
                )
              })}
            </nav>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500 sm:shrink-0">
                Active user
              </label>
              <div className="flex flex-wrap items-stretch gap-2">
                <select
                  value={currentUserId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) void selectUser(v)
                  }}
                  disabled={initialLoad || users.length === 0}
                  className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-base text-white disabled:opacity-50 sm:min-w-[10rem] sm:text-sm"
                >
                  <option value="">
                    {users.length === 0 ? 'No users yet' : 'Select…'}
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setAddUserOpen(true)}
                  disabled={initialLoad}
                  className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[var(--color-border)] px-4 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50"
                >
                  <UserPlus className="size-5 shrink-0" />
                  New user
                </button>
              </div>
            </div>
            {currentName ? (
              <p className="text-sm leading-snug text-zinc-400">
                Planning as <span className="text-white">{currentName}</span>
                <span className="text-zinc-500">
                  {' '}
                  <span className="hidden sm:inline">
                    — workouts and calendar are only theirs.
                  </span>
                </span>
              </p>
            ) : (
              <p className="text-sm leading-snug text-zinc-500">
                Shared exercise list. Pick a user for personal workouts and the
                calendar.
              </p>
            )}
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-5 md:py-8 md:pb-8">
        {initialLoad ? (
          <p className="text-center text-base text-zinc-500">Loading…</p>
        ) : (
          <>
            {tab === 'exercises' && <ExerciseLibrary />}
            {tab === 'workouts' &&
              (currentUserId ? <WorkoutBuilder /> : planGate)}
            {tab === 'calendar' &&
              (currentUserId ? <MonthCalendar /> : planGate)}
            {!currentUserId && users.length === 0 && tab === 'exercises' ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/50 p-6 text-center text-sm leading-relaxed text-zinc-500">
                <p className="text-base font-medium text-zinc-300">
                  Add users when ready
                </p>
                <p className="mt-2">
                  Create someone with <span className="text-zinc-300">New user</span>{' '}
                  so they can build private workout templates and a calendar.
                </p>
              </div>
            ) : null}
          </>
        )}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)]/95 backdrop-blur-md pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] md:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg gap-1 px-1">
          {tabs.map(({ id, label, shortLabel, icon }) => {
            const needsProfile =
              id !== 'exercises' && !currentUserId && !initialLoad
            return (
              <TabButton
                key={id}
                active={tab === id}
                disabled={needsProfile}
                onClick={() => setTab(id)}
                icon={icon}
                label={label}
                shortLabel={shortLabel}
                variant="bar"
              />
            )
          })}
        </div>
      </nav>

      <Modal
        title="New user"
        open={addUserOpen}
        onClose={() => {
          setAddUserOpen(false)
          setNewUserName('')
        }}
      >
        <form onSubmit={submitNewUser} className="space-y-4 text-left">
          <p className="text-sm leading-relaxed text-zinc-400">
            Names must be unique (case-insensitive). They get a private workout
            list and calendar; the exercise library stays shared. Anyone who can
            reach this app can open any profile—there is no authentication.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Display name
            </label>
            <input
              autoFocus
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="submit"
              disabled={loading || !newUserName.trim()}
              className="min-h-12 w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-base font-semibold text-[var(--color-surface)] hover:brightness-110 disabled:opacity-40 sm:w-auto"
            >
              Create and open
            </button>
            <button
              type="button"
              onClick={() => {
                setAddUserOpen(false)
                setNewUserName('')
              }}
              className="min-h-12 w-full rounded-xl border border-[var(--color-border)] px-4 py-3 text-base text-zinc-200 hover:bg-white/5 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

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

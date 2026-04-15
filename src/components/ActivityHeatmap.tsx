import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import {
  fetchHeatmap,
  type HeatmapPayload,
  type HeatmapPlanEntry,
} from '../api/client'

const WEEK_OPTIONS = [13, 26, 52] as const

function isoRange(from: string, to: string): string[] {
  const out: string[] = []
  let d = parseISO(from)
  const end = parseISO(to)
  while (d <= end) {
    out.push(format(d, 'yyyy-MM-dd'))
    d = addDays(d, 1)
  }
  return out
}

function chunkWeeks(days: string[]): string[][] {
  const cols: string[][] = []
  for (let i = 0; i < days.length; i += 7) {
    cols.push(days.slice(i, i + 7))
  }
  return cols
}

function planLookup(plans: HeatmapPlanEntry[]) {
  const byIso = new Map<string, Map<number, HeatmapPlanEntry>>()
  for (const p of plans) {
    const m = byIso.get(p.isoDate) ?? new Map<number, HeatmapPlanEntry>()
    m.set(p.userId, p)
    byIso.set(p.isoDate, m)
  }
  return byIso
}

function cellTitle(args: {
  iso: string
  today: string
  userName: string
  entry?: HeatmapPlanEntry
}): string {
  const { iso, today, userName, entry } = args
  if (iso > today) {
    return `${format(parseISO(iso), 'EEE MMM d')}\n${userName}\n(upcoming)`
  }
  const head = `${userName} · ${format(parseISO(iso), 'EEE MMM d, yyyy')}`
  if (!entry) return `${head}\nNo calendar entry`
  if (entry.kind === 'rest') return `${head}\nRest day`
  return `${head}\n${entry.workoutName?.trim() || 'Workout'}`
}

export function ActivityHeatmap() {
  const [weeks, setWeeks] = useState<(typeof WEEK_OPTIONS)[number]>(26)
  const [data, setData] = useState<HeatmapPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const payload = await fetchHeatmap(weeks)
      setData(payload)
    } catch (e) {
      setData(null)
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [weeks])

  useEffect(() => {
    void load()
  }, [load])

  const weekCols = useMemo(() => {
    if (!data) return []
    const days = isoRange(data.from, data.to)
    return chunkWeeks(days)
  }, [data])

  const byIso = useMemo(
    () => (data ? planLookup(data.plans) : new Map()),
    [data],
  )

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Activity heatmap
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-500">
            Only days each person checked as done on their calendar (like GitHub
            contributions): each column is one week,
            cells run Monday → Sunday top to bottom. One strip per person.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {WEEK_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setWeeks(n)}
              disabled={loading}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                weeks === n
                  ? 'bg-[var(--color-accent)] text-[var(--color-surface)]'
                  : 'border border-[var(--color-border)] text-zinc-300 hover:bg-white/5',
              ].join(' ')}
            >
              {n} wk
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <p className="mt-4 text-sm text-red-300/90" role="alert">
          {loadError}
        </p>
      ) : null}

      {loading && !data ? (
        <p className="mt-6 text-sm text-zinc-500">Loading heatmap…</p>
      ) : null}

      {data && data.users.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          Add a profile to start logging days on the calendar.
        </p>
      ) : null}

      {data && data.users.length > 0 ? (
        <div className="mt-6 overflow-x-auto pb-1">
          <div className="inline-block min-w-full">
            <div className="flex gap-2 sm:gap-3">
              <div className="w-20 shrink-0 sm:w-24" aria-hidden />
              <div className="flex gap-0.5">
              {weekCols.map((week, wi) => {
                const mon = week[0]
                const prevMon =
                  wi > 0 ? weekCols[wi - 1][0] : null
                const showMonth =
                  mon &&
                  (!prevMon ||
                    format(parseISO(mon), 'MMM yyyy') !==
                      format(parseISO(prevMon), 'MMM yyyy'))
                return (
                  <div
                    key={mon ?? wi}
                    className="flex w-[11px] shrink-0 flex-col gap-0.5 sm:w-[13px]"
                  >
                    <span className="mb-0.5 h-4 text-center text-[9px] font-medium leading-none text-zinc-500 sm:text-[10px]">
                      {showMonth ? format(parseISO(mon), 'MMM') : ''}
                    </span>
                  </div>
                )
              })}
              </div>
            </div>

            <div className="mt-1 space-y-3">
              {data.users.map((u) => (
                <div key={u.id} className="flex gap-2 sm:gap-3">
                  <div
                    className="w-20 shrink-0 truncate pt-0.5 text-right text-xs font-medium text-zinc-400 sm:w-24 sm:text-sm"
                    title={u.name}
                  >
                    {u.name}
                  </div>
                  <div className="flex gap-0.5">
                    {weekCols.map((week, wi) => (
                      <div
                        key={`${u.id}-${week[0] ?? wi}`}
                        className="flex w-[11px] shrink-0 flex-col gap-0.5 sm:w-[13px]"
                      >
                        {week.map((iso) => {
                          const entry = byIso.get(iso)?.get(u.id)
                          const isFuture = iso > data.today
                          const tile = (
                            <div
                              title={cellTitle({
                                iso,
                                today: data.today,
                                userName: u.name,
                                entry,
                              })}
                              className={[
                                'aspect-square w-full min-h-0 rounded-[2px] border',
                                isFuture
                                  ? 'border-transparent bg-zinc-900/25'
                                  : !entry
                                    ? 'border-zinc-800/80 bg-zinc-900/40'
                                    : entry.kind === 'rest'
                                      ? 'border-violet-500/25 bg-violet-950/50'
                                      : 'border-emerald-500/30 bg-emerald-600/35',
                              ].join(' ')}
                            />
                          )
                          return <div key={iso}>{tile}</div>
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
              <span className="font-medium text-zinc-400">Legend</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-[2px] border border-zinc-800/80 bg-zinc-900/40" />
                Empty
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-[2px] border border-violet-500/25 bg-violet-950/50" />
                Rest
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-[2px] border border-emerald-500/30 bg-emerald-600/35" />
                Workout
              </span>
              <span className="text-zinc-600">
                {format(parseISO(data.from), 'MMM d, yyyy')} —{' '}
                {format(parseISO(data.to), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

import { useState } from 'react'
import { ExternalLink, Pencil, Plus, Trash2, Video } from 'lucide-react'
import { useWorkoutStore } from '../store/workoutStore'
import type { Exercise } from '../types'
import { youtubeEmbedUrl } from '../lib/youtube'
import { Modal } from './Modal'

const emptyForm = {
  name: '',
  description: '',
  youtubeUrl: '',
}

export function ExerciseLibrary() {
  const exercises = useWorkoutStore((s) => s.exercises)
  const addExercise = useWorkoutStore((s) => s.addExercise)
  const updateExercise = useWorkoutStore((s) => s.updateExercise)
  const removeExercise = useWorkoutStore((s) => s.removeExercise)

  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [preview, setPreview] = useState<Exercise | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      if (editing) {
        await updateExercise(editing.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          youtubeUrl: form.youtubeUrl.trim(),
        })
        setEditing(null)
      } else {
        await addExercise({
          name: form.name.trim(),
          description: form.description.trim(),
          youtubeUrl: form.youtubeUrl.trim(),
        })
      }
      setForm(emptyForm)
    } catch {
      /* error surfaced in store */
    }
  }

  const startEdit = (ex: Exercise) => {
    setEditing(ex)
    setForm({
      name: ex.name,
      description: ex.description,
      youtubeUrl: ex.youtubeUrl,
    })
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm(emptyForm)
  }

  const embed = preview ? youtubeEmbedUrl(preview.youtubeUrl) : null

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Exercise library
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          This library is shared by everyone. Name each movement, add cues in the
          description, and link a YouTube demo when you want a quick visual
          refresher.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-zinc-300">
            {editing ? 'Edit exercise' : 'New exercise'}
          </span>
          {editing && (
            <button
              type="button"
              onClick={cancelEdit}
              className="min-h-11 px-2 text-sm text-zinc-400 hover:text-white"
            >
              Cancel edit
            </button>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1.5">
            Name
          </label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Bulgarian split squat"
            className="w-full min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1.5">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={3}
            placeholder="Setup, tempo, ROM, common mistakes…"
            className="w-full min-h-[6.5rem] resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1.5">
            YouTube link
          </label>
          <input
            value={form.youtubeUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, youtubeUrl: e.target.value }))
            }
            placeholder="https://www.youtube.com/watch?v=…"
            className="w-full min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 sm:text-sm"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-base font-semibold text-[var(--color-surface)] hover:brightness-110 sm:w-auto sm:text-sm"
        >
          {editing ? (
            <>
              <Pencil className="size-4" />
              Save changes
            </>
          ) : (
            <>
              <Plus className="size-4" />
              Add exercise
            </>
          )}
        </button>
      </form>

      {exercises.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No exercises yet. Add your first one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {exercises.map((ex) => (
            <li
              key={ex.id}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 text-left">
                <p className="font-medium text-white">{ex.name}</p>
                {ex.description ? (
                  <p className="mt-1 text-sm text-zinc-400 whitespace-pre-wrap">
                    {ex.description}
                  </p>
                ) : null}
                {ex.youtubeUrl ? (
                  <a
                    href={ex.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-11 items-center gap-1 text-base text-[var(--color-accent)] hover:underline sm:text-sm"
                  >
                    Open video
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2 self-end sm:self-start">
                {ex.youtubeUrl ? (
                  <button
                    type="button"
                    onClick={() => setPreview(ex)}
                    className="inline-flex size-11 items-center justify-center rounded-xl border border-[var(--color-border)] text-zinc-300 hover:bg-white/5 hover:text-white"
                    title="Preview video"
                  >
                    <Video className="size-5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => startEdit(ex)}
                  className="inline-flex size-11 items-center justify-center rounded-xl border border-[var(--color-border)] text-zinc-300 hover:bg-white/5 hover:text-white"
                  title="Edit"
                >
                  <Pencil className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Remove “${ex.name}”? It will disappear from any workouts that use it.`,
                      )
                    )
                      return
                    try {
                      await removeExercise(ex.id)
                    } catch {
                      /* error surfaced in store */
                    }
                  }}
                  className="inline-flex size-11 items-center justify-center rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10"
                  title="Delete"
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        title={preview?.name ?? 'Video'}
        open={!!preview}
        onClose={() => setPreview(null)}
      >
        {preview && embed ? (
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            <iframe
              title="YouTube preview"
              src={embed}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : preview ? (
          <p className="text-sm text-zinc-400">
            This link does not look like a supported YouTube URL. You can still
            open it from the exercise card.
          </p>
        ) : null}
      </Modal>
    </div>
  )
}

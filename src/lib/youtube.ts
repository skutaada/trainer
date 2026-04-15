/** Returns embed URL or null if the string is not a recognizable YouTube link. */
export function youtubeEmbedUrl(raw: string): string | null {
  const input = raw.trim()
  if (!input) return null
  try {
    const u = new URL(
      input.startsWith('http') ? input : `https://${input}`,
    )
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)
      if (m?.[1]) return `https://www.youtube.com/embed/${m[1]}`
    }
  } catch {
    return null
  }
  return null
}

import type { Note } from '../../../shared/types'

export type CopyKind = 'title' | 'content' | 'plain' | 'markdown' | 'html' | 'link'

function markdownToPlain(content: string): string {
  return content.replace(/[#*_`>|-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function markdownToHtml(note: Note): string {
  return `<h1>${escapeHtml(note.title)}</h1>\n<pre>${escapeHtml(note.content)}</pre>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export async function copyNote(note: Note, kind: CopyKind): Promise<void> {
  const value =
    kind === 'title'
      ? note.title
      : kind === 'content'
        ? note.content
        : kind === 'plain'
          ? markdownToPlain(note.content)
          : kind === 'markdown'
            ? `# ${note.title}\n\n${note.content}`
            : kind === 'html'
              ? markdownToHtml(note)
              : `privatenotes://${note.id}`

  await navigator.clipboard.writeText(value)
}

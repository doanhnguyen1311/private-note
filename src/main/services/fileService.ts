import { BrowserWindow, dialog } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { basename, extname } from 'path'
import { marked } from 'marked'
import type { ExportRequest, ImportFormat, ImportResult, Note, NoteInput } from '../../shared/types'
import { exportNotesSnapshot, getNoteById, importNotes } from '../../database/notesRepository'
import { performBackup } from '../backup/index'

function noteToMarkdown(note: Note): string {
  const tags = note.tags.length ? `\n\nTags: ${note.tags.map((tag) => `#${tag}`).join(' ')}` : ''
  return `# ${note.title}\n\n${note.content}${tags}\n`
}

function noteToPlainText(note: Note): string {
  return `${note.title}\n\n${note.content.replace(/[#*_`>|-]/g, ' ').replace(/\s+/g, ' ').trim()}`
}

function noteToHtml(note: Note): string {
  const body = marked.parse(note.content || '', { async: false }) as string
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(note.title)}</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; max-width: 820px; margin: 48px auto; line-height: 1.7; color: #18181b; }
    pre { background: #f4f4f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #d4d4d8; padding: 8px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(note.title)}</h1>
  ${body}
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function defaultExportName(note: Note | null, extension: string): string {
  const base = note?.title.trim() || 'private-notes'
  return `${base.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)}.${extension}`
}

export async function exportData(request: ExportRequest, owner?: BrowserWindow): Promise<boolean> {
  const note = request.noteId ? getNoteById(request.noteId) : null
  const extension = request.format === 'markdown' ? 'md' : request.format
  const options = {
    title: 'Export',
    defaultPath: defaultExportName(note, extension),
    filters: [{ name: request.format.toUpperCase(), extensions: [extension] }]
  }
  const dialogOwner = owner ?? BrowserWindow.getFocusedWindow()
  const result = dialogOwner ? await dialog.showSaveDialog(dialogOwner, options) : await dialog.showSaveDialog(options)

  if (result.canceled || !result.filePath) return false

  if (request.format === 'json') {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), notes: exportNotesSnapshot() }, null, 2)
    writeFileSync(result.filePath, payload, 'utf8')
    return true
  }

  if (!note) throw new Error('A note is required for this export format')

  if (request.format === 'markdown') writeFileSync(result.filePath, noteToMarkdown(note), 'utf8')
  if (request.format === 'txt') writeFileSync(result.filePath, noteToPlainText(note), 'utf8')
  if (request.format === 'html') writeFileSync(result.filePath, noteToHtml(note), 'utf8')
  if (request.format === 'pdf') {
    const pdfWindow = new BrowserWindow({ show: false })
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(noteToHtml(note))}`)
    const pdf = await pdfWindow.webContents.printToPDF({ printBackground: true })
    writeFileSync(result.filePath, pdf)
    pdfWindow.destroy()
  }

  return true
}

export async function importData(format: ImportFormat, owner?: BrowserWindow): Promise<ImportResult> {
  const options = {
    title: 'Import',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: format.toUpperCase(),
        extensions: format === 'markdown' ? ['md', 'markdown'] : format === 'json' ? ['json'] : ['txt']
      }
    ]
  } satisfies Electron.OpenDialogOptions
  const dialogOwner = owner ?? BrowserWindow.getFocusedWindow()
  const result = dialogOwner ? await dialog.showOpenDialog(dialogOwner, options) : await dialog.showOpenDialog(options)

  if (result.canceled) return { imported: 0 }

  const notes: NoteInput[] = []
  for (const filePath of result.filePaths) {
    if (!existsSync(filePath)) continue
    const text = readFileSync(filePath, 'utf8')
    if (format === 'json') {
      const parsed = JSON.parse(text) as { notes?: Note[] }
      parsed.notes?.forEach((note) => {
        notes.push({
          title: note.title,
          content: note.content,
          tags: note.tags,
          folder: note.folder,
          colorLabel: note.colorLabel,
          favorite: note.favorite,
          pinned: note.pinned,
          archived: note.archived
        })
      })
    } else {
      const title = basename(filePath, extname(filePath))
      notes.push({ title, content: text, tags: [format === 'markdown' ? 'Imported Markdown' : 'Imported TXT'] })
    }
  }

  importNotes(notes)
  return { imported: notes.length }
}

export function backupNow(): void {
  performBackup()
}

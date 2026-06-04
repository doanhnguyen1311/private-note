import { app } from 'electron'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'crypto'
import { dirname, join } from 'path'
import type { Note, NoteInput, NotesQuery, NoteSort, NoteUpdate } from '../shared/types'

type NoteRow = {
  id: string
  title: string
  content: string
  tags: string | null
  folder: string | null
  color_label: string | null
  favorite: number
  pinned: number
  archived: number
  trashed: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

let db: Database.Database | null = null
let databasePath = ''

const starterNotes: NoteInput[] = [
  {
    title: 'Welcome to Private Notes',
    content:
      '# Private Notes\n\nWrite securely offline with markdown preview, fast search, tags, favorites, pins, and backups.\n\n- Use `Ctrl+N` to create a note\n- Use `Ctrl+F` to search\n- Use `Ctrl+D` to duplicate\n\n| Feature | Status |\n| --- | --- |\n| Markdown | Ready |\n| Local storage | Ready |',
    tags: ['Personal', 'Idea'],
    pinned: true
  },
  {
    title: 'Project ideas',
    content: 'Capture private ideas here. Add tags from the editor header and pin anything that needs attention.',
    tags: ['Project', 'Work']
  }
]

export function getDatabasePath(): string {
  if (databasePath) return databasePath
  return join(app.getPath('userData'), 'notes.db')
}

export function initDatabase(): void {
  databasePath = getDatabasePath()
  const folder = dirname(databasePath)
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true })
  }

  db = new Database(databasePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      folder TEXT,
      color_label TEXT,
      favorite INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS folders (
      path TEXT PRIMARY KEY,
      created_at TEXT
    );
  `)

  addColumnIfMissing('folder TEXT')
  addColumnIfMissing('color_label TEXT')
  addColumnIfMissing('archived INTEGER DEFAULT 0')
  addColumnIfMissing('trashed INTEGER DEFAULT 0')
  addColumnIfMissing('deleted_at TEXT')

  const count = db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number }
  if (count.count === 0) {
    starterNotes.forEach((note) => createNote(note))
  }
}

function addColumnIfMissing(definition: string): void {
  try {
    connection().exec(`ALTER TABLE notes ADD COLUMN ${definition};`)
  } catch {
    // Column already exists in normal app startups.
  }
}

function connection(): Database.Database {
  if (!db) initDatabase()
  if (!db) throw new Error('Database failed to initialize')
  return db
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeTags(tags: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  )
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function getEncryptionKey(): Buffer | null {
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    if (!existsSync(settingsPath)) return null
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      encryptionEnabled?: boolean
      passwordHash?: string | null
    }
    if (!settings.encryptionEnabled || !settings.passwordHash) return null
    const key = Buffer.from(settings.passwordHash, 'hex')
    return key.length === 32 ? key : null
  } catch {
    return null
  }
}

function encryptContent(content: string): string {
  const key = getEncryptionKey()
  if (!key || content.startsWith('enc:v1:')) return content

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

function decryptContent(content: string): string {
  if (!content.startsWith('enc:v1:')) return content
  const key = getEncryptionKey()
  if (!key) return '[Encrypted note content is locked. Enable the password to decrypt.]'

  try {
    const [, , iv, tag, encrypted] = content.split(':')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return '[Encrypted note content could not be decrypted.]'
  }
}

function parseStoredTags(value: string | null): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return normalizeTags(parsed.filter((tag): tag is string => typeof tag === 'string'))
    }
    if (typeof parsed === 'string') {
      return normalizeTags(parsed.split(','))
    }
  } catch {
    return normalizeTags(value.split(','))
  }

  return []
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: decryptContent(row.content),
    tags: parseStoredTags(row.tags),
    folder: row.folder ?? null,
    colorLabel: row.color_label ?? null,
    favorite: Boolean(row.favorite),
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    trashed: Boolean(row.trashed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  }
}

function getNoteRequired(id: string): Note {
  const row = connection().prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined
  if (!row) throw new Error(`Note not found: ${id}`)
  return toNote(row)
}

export function listNotes(query: NotesQuery = {}): Note[] {
  const rows = connection()
    .prepare(
      `SELECT * FROM notes
       WHERE (? = 1 OR trashed = 0)
       ORDER BY pinned DESC, datetime(updated_at) DESC`
    )
    .all(query.includeTrash ? 1 : 0) as NoteRow[]

  const search = query.search?.trim().toLowerCase()
  const tag = query.tag?.trim().toLowerCase()
  const folder = query.folder?.trim().toLowerCase()
  const colorLabel = query.colorLabel?.trim().toLowerCase()

  let notes = rows.map(toNote)

  if (query.filter === 'trash') {
    notes = notes.filter((note) => note.trashed)
  } else if (query.filter === 'archive') {
    notes = notes.filter((note) => !note.trashed && note.archived)
  } else {
    notes = notes.filter((note) => !note.trashed && !note.archived)
  }

  if (query.filter === 'favorites') notes = notes.filter((note) => note.favorite)
  if (query.filter === 'pinned') notes = notes.filter((note) => note.pinned)
  if (query.filter === 'recent') {
    notes = notes.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 50)
  }
  if (query.filter === 'created') {
    notes = notes.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 50)
  }

  if (tag) {
    notes = notes.filter((note) => note.tags.some((noteTag) => noteTag.toLowerCase() === tag))
  }

  if (folder) {
    notes = notes.filter((note) => {
      const noteFolder = note.folder?.toLowerCase()
      return noteFolder === folder || noteFolder?.startsWith(`${folder}/`)
    })
  }

  if (colorLabel) {
    notes = notes.filter((note) => note.colorLabel?.toLowerCase() === colorLabel)
  }

  if (search) {
    notes = notes.filter((note) => {
      const haystack = `${note.title}\n${note.content}\n${note.tags.join(' ')}\n${note.folder ?? ''}`.toLowerCase()
      return haystack.includes(search)
    })
  }

  notes = sortNotes(notes, query.sort)

  if (query.limit && query.limit > 0) {
    notes = notes.slice(0, query.limit)
  }

  return notes
}

function sortNotes(notes: Note[], sort: NoteSort | undefined): Note[] {
  const copy = [...notes]
  if (sort === 'title') {
    return copy.sort((a, b) => a.title.localeCompare(b.title))
  }
  if (sort === 'createdAt') {
    return copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }
  if (sort === 'favorite') {
    return copy.sort((a, b) => Number(b.favorite) - Number(a.favorite) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }
  if (sort === 'pinned') {
    return copy.sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }
  return copy.sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export function createNote(input: NoteInput = {}): Note {
  const timestamp = nowIso()
  const note: Note = {
    id: randomUUID(),
    title: input.title?.trim() ?? '',
    content: input.content ?? '',
    tags: normalizeTags(input.tags),
    folder: normalizeNullableText(input.folder),
    colorLabel: normalizeNullableText(input.colorLabel),
    favorite: Boolean(input.favorite),
    pinned: Boolean(input.pinned),
    archived: Boolean(input.archived),
    trashed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null
  }

  connection()
    .prepare(
      `INSERT INTO notes (
        id, title, content, tags, folder, color_label, favorite, pinned, archived, trashed, created_at, updated_at, deleted_at
      ) VALUES (
        @id, @title, @content, @tags, @folder, @colorLabel, @favorite, @pinned, @archived, @trashed, @createdAt, @updatedAt, @deletedAt
      )`
    )
    .run({
      ...note,
      content: encryptContent(note.content),
      tags: JSON.stringify(note.tags),
      favorite: note.favorite ? 1 : 0,
      pinned: note.pinned ? 1 : 0,
      archived: note.archived ? 1 : 0,
      trashed: note.trashed ? 1 : 0
    })

  return note
}

export function updateNote(id: string, updates: NoteUpdate): Note {
  const existing = getNoteRequired(id)
  const updated: Note = {
    ...existing,
    title: updates.title === undefined ? existing.title : updates.title.trim(),
    content: updates.content ?? existing.content,
    tags: updates.tags === undefined ? existing.tags : normalizeTags(updates.tags),
    folder: updates.folder === undefined ? existing.folder : normalizeNullableText(updates.folder),
    colorLabel: updates.colorLabel === undefined ? existing.colorLabel : normalizeNullableText(updates.colorLabel),
    favorite: updates.favorite ?? existing.favorite,
    pinned: updates.pinned ?? existing.pinned,
    archived: updates.archived ?? existing.archived,
    trashed: updates.trashed ?? existing.trashed,
    updatedAt: nowIso(),
    deletedAt: updates.trashed === true ? nowIso() : updates.trashed === false ? null : existing.deletedAt
  }

  connection()
    .prepare(
      `UPDATE notes
       SET title = @title,
           content = @content,
           tags = @tags,
           folder = @folder,
           color_label = @colorLabel,
           favorite = @favorite,
           pinned = @pinned,
           archived = @archived,
           trashed = @trashed,
           updated_at = @updatedAt,
           deleted_at = @deletedAt
       WHERE id = @id`
    )
    .run({
      ...updated,
      content: encryptContent(updated.content),
      tags: JSON.stringify(updated.tags),
      favorite: updated.favorite ? 1 : 0,
      pinned: updated.pinned ? 1 : 0,
      archived: updated.archived ? 1 : 0,
      trashed: updated.trashed ? 1 : 0
    })

  return updated
}

export function duplicateNote(id: string): Note {
  const source = getNoteRequired(id)
  return createNote({
    title: `${source.title} copy`,
    content: source.content,
    tags: source.tags,
    folder: source.folder,
    colorLabel: source.colorLabel,
    favorite: source.favorite,
    pinned: false
  })
}

export function moveToTrash(id: string): void {
  updateNote(id, { trashed: true, archived: false, pinned: false })
}

export function restoreNote(id: string): Note {
  return updateNote(id, { trashed: false })
}

export function deleteNotePermanent(id: string): void {
  connection().prepare('DELETE FROM notes WHERE id = ?').run(id)
}

export function listTags(): string[] {
  const tags = new Set<string>()
  listNotes({ includeTrash: false }).forEach((note) => {
    note.tags.forEach((tag) => tags.add(tag))
  })
  return Array.from(tags).sort((a, b) => a.localeCompare(b))
}

export function listFolders(): string[] {
  const folders = new Set<string>()
  const rows = connection().prepare('SELECT path FROM folders ORDER BY path ASC').all() as Array<{ path: string }>
  rows.forEach((row) => {
    normalizeFolderPath(row.path)
      ?.split('/')
      .forEach((_, index, parts) => folders.add(parts.slice(0, index + 1).join('/')))
  })

  listNotes({ includeTrash: false }).forEach((note) => {
    if (note.folder) {
      const parts = note.folder.split('/').map((part) => part.trim()).filter(Boolean)
      parts.forEach((_, index) => folders.add(parts.slice(0, index + 1).join('/')))
    }
  })
  return Array.from(folders).sort((a, b) => a.localeCompare(b))
}

function normalizeFolderPath(value: string | null | undefined): string | null {
  const path = value
    ?.split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/')
  return path || null
}

export function createFolder(path: string): string {
  const normalized = normalizeFolderPath(path)
  if (!normalized) throw new Error('Folder name is required')

  const timestamp = nowIso()
  const parts = normalized.split('/')
  const insert = connection().prepare('INSERT OR IGNORE INTO folders (path, created_at) VALUES (?, ?)')
  parts.forEach((_, index) => {
    insert.run(parts.slice(0, index + 1).join('/'), timestamp)
  })

  return normalized
}

export function deleteFolder(path: string): void {
  const normalized = normalizeFolderPath(path)
  if (!normalized) throw new Error('Folder name is required')

  const db = connection()
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM folders WHERE path = ? OR path LIKE ?').run(normalized, `${normalized}/%`)
    db.prepare(
      `UPDATE notes
       SET folder = NULL,
           updated_at = ?
       WHERE folder = ? OR folder LIKE ?`
    ).run(nowIso(), normalized, `${normalized}/%`)
  })

  transaction()
}

export function importNotes(notes: NoteInput[]): Note[] {
  return notes.map((note) => createNote(note))
}

export function exportNotesSnapshot(): Note[] {
  return listNotes({ includeTrash: true })
}

export function getNoteById(id: string): Note {
  return getNoteRequired(id)
}

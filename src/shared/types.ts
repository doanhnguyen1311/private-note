export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  folder: string | null
  colorLabel: string | null
  favorite: boolean
  pinned: boolean
  archived: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type NoteFilter =
  | 'all'
  | 'favorites'
  | 'pinned'
  | 'recent'
  | 'created'
  | 'archive'
  | 'trash'

export type NoteSort = 'updatedAt' | 'createdAt' | 'title' | 'favorite' | 'pinned'

export type ExportFormat = 'markdown' | 'txt' | 'html' | 'pdf' | 'json'

export type ImportFormat = 'markdown' | 'txt' | 'json'

export interface NoteInput {
  title?: string
  content?: string
  tags?: string[]
  folder?: string | null
  colorLabel?: string | null
  favorite?: boolean
  pinned?: boolean
  archived?: boolean
}

export type NoteUpdate = Partial<NoteInput> & {
  trashed?: boolean
}

export interface NotesQuery {
  search?: string
  filter?: NoteFilter
  tag?: string | null
  folder?: string | null
  colorLabel?: string | null
  sort?: NoteSort
  includeTrash?: boolean
  limit?: number
}

export interface AppSettings {
  theme: 'dark' | 'light'
  fontSize: number
  autoSaveDelay: number
  backupRetentionDays: number
  databaseLocation: string
  passwordHash: string | null
  autoLockMinutes: number
  hideRecentContent: boolean
  encryptionEnabled: boolean
}

export type SettingsUpdate = Partial<
  Pick<
    AppSettings,
    | 'theme'
    | 'fontSize'
    | 'autoSaveDelay'
    | 'backupRetentionDays'
    | 'passwordHash'
    | 'autoLockMinutes'
    | 'hideRecentContent'
    | 'encryptionEnabled'
  >
>

export interface ExportRequest {
  noteId?: string
  format: ExportFormat
}

export interface ImportResult {
  imported: number
}

export interface AppUpdateInfo {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  repositoryUrl: string
  branch: string
  checkedAt: string
}

export interface PrivateNotesApi {
  notes: {
    list: (query?: NotesQuery) => Promise<Note[]>
    create: (note?: Partial<NoteInput>) => Promise<Note>
    update: (id: string, updates: NoteUpdate) => Promise<Note>
    duplicate: (id: string) => Promise<Note>
    moveToTrash: (id: string) => Promise<void>
    restore: (id: string) => Promise<Note>
    deletePermanent: (id: string) => Promise<void>
  }
  tags: {
    list: () => Promise<string[]>
  }
  folders: {
    list: () => Promise<string[]>
    create: (path: string) => Promise<string>
    delete: (path: string) => Promise<void>
  }
  backup: {
    create: () => Promise<void>
  }
  files: {
    export: (request: ExportRequest) => Promise<boolean>
    import: (format: ImportFormat) => Promise<ImportResult>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (settings: SettingsUpdate) => Promise<AppSettings>
  }
  updates: {
    check: () => Promise<AppUpdateInfo>
    openRepository: () => Promise<void>
  }
}

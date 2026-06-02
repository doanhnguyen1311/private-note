import { contextBridge, ipcRenderer } from 'electron'
import type {
  ExportRequest,
  ImportFormat,
  NoteInput,
  NotesQuery,
  NoteUpdate,
  PrivateNotesApi,
  SettingsUpdate
} from '../shared/types'

const api: PrivateNotesApi = {
  notes: {
    list: (query?: NotesQuery) => ipcRenderer.invoke('notes:list', query),
    create: (note?: NoteInput) => ipcRenderer.invoke('notes:create', note),
    update: (id: string, updates: NoteUpdate) => ipcRenderer.invoke('notes:update', id, updates),
    duplicate: (id: string) => ipcRenderer.invoke('notes:duplicate', id),
    moveToTrash: (id: string) => ipcRenderer.invoke('notes:moveToTrash', id),
    restore: (id: string) => ipcRenderer.invoke('notes:restore', id),
    deletePermanent: (id: string) => ipcRenderer.invoke('notes:deletePermanent', id)
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list')
  },
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    create: (path: string) => ipcRenderer.invoke('folders:create', path),
    delete: (path: string) => ipcRenderer.invoke('folders:delete', path)
  },
  backup: {
    create: () => ipcRenderer.invoke('backup:create')
  },
  files: {
    export: (request: ExportRequest) => ipcRenderer.invoke('files:export', request),
    import: (format: ImportFormat) => ipcRenderer.invoke('files:import', format)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings: SettingsUpdate) => ipcRenderer.invoke('settings:update', settings)
  },
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    openRepository: () => ipcRenderer.invoke('updates:openRepository')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('privateNotes', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.privateNotes = api
}

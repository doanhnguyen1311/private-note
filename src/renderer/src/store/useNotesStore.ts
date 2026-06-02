import { create } from 'zustand'
import type { Note, NoteFilter, NoteInput, NoteSort, NoteUpdate } from '../../../shared/types'

interface NotesState {
  notes: Note[]
  tags: string[]
  folders: string[]
  activeNoteId: string | null
  searchQuery: string
  filter: NoteFilter
  selectedTag: string | null
  selectedFolder: string | null
  selectedColorLabel: string | null
  sort: NoteSort
  loading: boolean
  loadNotes: () => Promise<void>
  loadTags: () => Promise<void>
  loadFolders: () => Promise<void>
  createFolder: (path: string) => Promise<string | null>
  deleteFolder: (path: string) => Promise<void>
  setActiveNote: (id: string | null) => void
  setSearchQuery: (query: string) => Promise<void>
  setFilter: (filter: NoteFilter) => Promise<void>
  setSelectedTag: (tag: string | null) => Promise<void>
  setSelectedFolder: (folder: string | null) => Promise<void>
  setSelectedColorLabel: (label: string | null) => Promise<void>
  setSort: (sort: NoteSort) => Promise<void>
  createNote: (input?: NoteInput) => Promise<void>
  updateNote: (id: string, updates: NoteUpdate) => Promise<Note | null>
  duplicateNote: (id: string) => Promise<void>
  moveToTrash: (id: string) => Promise<void>
  restoreNote: (id: string) => Promise<void>
  deletePermanent: (id: string) => Promise<void>
  refreshOrganization: () => Promise<void>
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  tags: [],
  folders: [],
  activeNoteId: null,
  searchQuery: '',
  filter: 'all',
  selectedTag: null,
  selectedFolder: null,
  selectedColorLabel: null,
  sort: 'updatedAt',
  loading: false,

  loadNotes: async () => {
    const { filter, searchQuery, selectedTag, selectedFolder, selectedColorLabel, sort } = get()
    set({ loading: true })
    const notes = await window.privateNotes.notes.list({
      filter,
      search: searchQuery,
      tag: selectedTag,
      folder: selectedFolder,
      colorLabel: selectedColorLabel,
      sort,
      includeTrash: filter === 'trash'
    })

    const activeNoteId = notes.some((note) => note.id === get().activeNoteId)
      ? get().activeNoteId
      : notes[0]?.id ?? null

    set({ notes, activeNoteId, loading: false })
  },

  loadTags: async () => {
    const tags = await window.privateNotes.tags.list()
    set({ tags })
  },

  loadFolders: async () => {
    const folders = await window.privateNotes.folders.list()
    set({ folders })
  },

  createFolder: async (path) => {
    const folder = await window.privateNotes.folders.create(path)
    set({ selectedFolder: folder, filter: 'all', selectedTag: null, selectedColorLabel: null })
    await get().refreshOrganization()
    await get().loadNotes()
    return folder
  },

  deleteFolder: async (path) => {
    await window.privateNotes.folders.delete(path)
    const selectedFolder = get().selectedFolder
    if (selectedFolder === path || selectedFolder?.startsWith(`${path}/`)) {
      set({ selectedFolder: null })
    }
    await get().refreshOrganization()
    await get().loadNotes()
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  setSearchQuery: async (query) => {
    set({ searchQuery: query })
    await get().loadNotes()
  },

  setFilter: async (filter) => {
    set({ filter })
    await get().loadNotes()
  },

  setSelectedTag: async (tag) => {
    set({ selectedTag: tag })
    await get().loadNotes()
  },

  setSelectedFolder: async (folder) => {
    set({ selectedFolder: folder })
    await get().loadNotes()
  },

  setSelectedColorLabel: async (label) => {
    set({ selectedColorLabel: label })
    await get().loadNotes()
  },

  setSort: async (sort) => {
    set({ sort })
    await get().loadNotes()
  },

  createNote: async (input) => {
    const note = await window.privateNotes.notes.create(input)
    const targetFolder = input?.folder ?? null
    set({
      filter: 'all',
      selectedTag: null,
      selectedFolder: targetFolder,
      selectedColorLabel: null,
      searchQuery: '',
      activeNoteId: note.id
    })
    await get().loadNotes()
    await get().refreshOrganization()
  },

  updateNote: async (id, updates) => {
    const current = get().notes.find((note) => note.id === id)
    if (!current) return null

    const optimistic: Note = {
      ...current,
      ...updates,
      title: updates.title === undefined ? current.title : updates.title,
      content: updates.content === undefined ? current.content : updates.content,
      tags: updates.tags === undefined ? current.tags : updates.tags,
      folder: updates.folder === undefined ? current.folder : updates.folder,
      colorLabel: updates.colorLabel === undefined ? current.colorLabel : updates.colorLabel,
      archived: updates.archived === undefined ? current.archived : updates.archived,
      updatedAt: new Date().toISOString()
    }
    set({ notes: get().notes.map((note) => (note.id === id ? optimistic : note)) })

    const saved = await window.privateNotes.notes.update(id, updates)
    set({ notes: get().notes.map((note) => (note.id === id ? saved : note)) })
    await get().refreshOrganization()
    return saved
  },

  duplicateNote: async (id) => {
    const note = await window.privateNotes.notes.duplicate(id)
    set({
      filter: 'all',
      selectedTag: null,
      selectedFolder: null,
      selectedColorLabel: null,
      searchQuery: '',
      activeNoteId: note.id
    })
    await get().loadNotes()
    await get().refreshOrganization()
  },

  moveToTrash: async (id) => {
    await window.privateNotes.notes.moveToTrash(id)
    await get().loadNotes()
    await get().refreshOrganization()
  },

  restoreNote: async (id) => {
    const note = await window.privateNotes.notes.restore(id)
    set({ filter: 'all', activeNoteId: note.id })
    await get().loadNotes()
    await get().refreshOrganization()
  },

  deletePermanent: async (id) => {
    await window.privateNotes.notes.deletePermanent(id)
    await get().loadNotes()
    await get().refreshOrganization()
  },

  refreshOrganization: async () => {
    await Promise.all([get().loadTags(), get().loadFolders()])
  }
}))

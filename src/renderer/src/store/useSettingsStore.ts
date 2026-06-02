import { create } from 'zustand'
import type { AppSettings, SettingsUpdate } from '../../../shared/types'

interface SettingsState {
  settings: AppSettings
  loading: boolean
  loadSettings: () => Promise<void>
  updateSettings: (updates: SettingsUpdate) => Promise<void>
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  fontSize: 16,
  autoSaveDelay: 500,
  backupRetentionDays: 30,
  databaseLocation: '',
  passwordHash: null,
  autoLockMinutes: 10,
  hideRecentContent: false,
  encryptionEnabled: false
}

function applySettings(settings: AppSettings): void {
  document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  document.documentElement.style.setProperty('--editor-font-size', `${settings.fontSize}px`)
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,

  loadSettings: async () => {
    set({ loading: true })
    const settings = await window.privateNotes.settings.get()
    applySettings(settings)
    set({ settings, loading: false })
  },

  updateSettings: async (updates) => {
    const optimistic = { ...get().settings, ...updates }
    applySettings(optimistic)
    set({ settings: optimistic })

    const settings = await window.privateNotes.settings.update(updates)
    applySettings(settings)
    set({ settings })
  }
}))

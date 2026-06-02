import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { getDatabasePath } from '../../database/notesRepository'
import type { AppSettings, SettingsUpdate } from '../../shared/types'

const defaults: Omit<AppSettings, 'databaseLocation'> = {
  theme: 'dark',
  fontSize: 16,
  autoSaveDelay: 500,
  backupRetentionDays: 30,
  passwordHash: null,
  autoLockMinutes: 10,
  hideRecentContent: false,
  encryptionEnabled: false
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function readStoredSettings(): Partial<AppSettings> {
  const settingsPath = getSettingsPath()
  if (!existsSync(settingsPath)) return {}

  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8')) as Partial<AppSettings>
  } catch {
    return {}
  }
}

function writeStoredSettings(settings: AppSettings): void {
  const settingsPath = getSettingsPath()
  const folder = dirname(settingsPath)
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true })
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
}

export function getSettings(): AppSettings {
  const stored = readStoredSettings()
  return {
    ...defaults,
    ...stored,
    autoSaveDelay: Math.max(150, Number(stored.autoSaveDelay ?? defaults.autoSaveDelay)),
    backupRetentionDays: Math.max(1, Number(stored.backupRetentionDays ?? defaults.backupRetentionDays)),
    fontSize: Math.min(22, Math.max(13, Number(stored.fontSize ?? defaults.fontSize))),
    passwordHash: stored.passwordHash ?? defaults.passwordHash,
    autoLockMinutes: Math.max(1, Number(stored.autoLockMinutes ?? defaults.autoLockMinutes)),
    hideRecentContent: Boolean(stored.hideRecentContent ?? defaults.hideRecentContent),
    encryptionEnabled: Boolean(stored.encryptionEnabled ?? defaults.encryptionEnabled),
    databaseLocation: getDatabasePath()
  }
}

export function updateSettings(updates: SettingsUpdate): AppSettings {
  const current = getSettings()
  const next: AppSettings = {
    ...current,
    ...updates,
    theme: updates.theme ?? current.theme,
    fontSize: Math.min(22, Math.max(13, Number(updates.fontSize ?? current.fontSize))),
    autoSaveDelay: Math.max(150, Number(updates.autoSaveDelay ?? current.autoSaveDelay)),
    backupRetentionDays: Math.max(1, Number(updates.backupRetentionDays ?? current.backupRetentionDays)),
    passwordHash: updates.passwordHash === undefined ? current.passwordHash : updates.passwordHash,
    autoLockMinutes: Math.max(1, Number(updates.autoLockMinutes ?? current.autoLockMinutes)),
    hideRecentContent: updates.hideRecentContent ?? current.hideRecentContent,
    encryptionEnabled: updates.encryptionEnabled ?? current.encryptionEnabled,
    databaseLocation: getDatabasePath()
  }

  writeStoredSettings(next)
  return next
}

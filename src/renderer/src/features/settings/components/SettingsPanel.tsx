import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, Download, ExternalLink, Lock, Moon, RefreshCw, RotateCcw, Sun, Upload, X } from 'lucide-react'
import type { AppUpdateInfo } from '../../../../../shared/types'
import { useSettingsStore } from '../../../store/useSettingsStore'
import { useNotesStore } from '../../../store/useNotesStore'
import { useToastStore } from '../../../store/useToastStore'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const settings = useSettingsStore((state) => state.settings)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const loadNotes = useNotesStore((state) => state.loadNotes)
  const refreshOrganization = useNotesStore((state) => state.refreshOrganization)
  const showToast = useToastStore((state) => state.showToast)

  if (!open) return null

  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-black/45 backdrop-blur-sm">
      <section className="h-full w-[420px] max-w-full border-l border-white/25 bg-black px-5 shadow-2xl overflow-y-auto">
        <div className="mb-6 flex items-center justify-between sticky top-0 z-10 bg-black py-5 border-b mb-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">Settings</h2>
            <p className="text-sm text-zinc-300">Local preferences and backup policy</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-200 transition hover:bg-white/10 hover:text-white"
            title="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6">
          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-300">Appearance</p>
            <div className="flex rounded-lg border border-white/25 bg-zinc-950 p-1">
              {[
                { id: 'dark' as const, label: 'Dark', icon: Moon },
                { id: 'light' as const, label: 'Light', icon: Sun }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void updateSettings({ theme: item.id })}
                  className={`flex h-9 flex-1 items-center justify-center gap-2 rounded-md text-sm transition ${settings.theme === item.id ? 'bg-white/10 text-zinc-50' : 'text-zinc-300 hover:text-zinc-200'
                    }`}
                >
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-300">Application</p>
            <CheckUpdateControl />
          </section>

          <section className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-300">Editor</p>
            <label className="block">
              <span className="mb-2 flex items-center justify-between text-sm text-zinc-300">
                Font size
                <span className="text-zinc-300">{settings.fontSize}px</span>
              </span>
              <input
                type="range"
                min={13}
                max={22}
                value={settings.fontSize}
                onChange={(event) => void updateSettings({ fontSize: Number(event.target.value) })}
                className="w-full accent-cyan-300"
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center justify-between text-sm text-zinc-300">
                Auto save delay
                <span className="text-zinc-300">{settings.autoSaveDelay}ms</span>
              </span>
              <input
                type="number"
                min={150}
                step={50}
                value={settings.autoSaveDelay}
                onChange={(event) => void updateSettings({ autoSaveDelay: Number(event.target.value) })}
                className="h-10 w-full rounded-lg border border-white/25 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-cyan-200"
              />
            </label>
          </section>

          <section className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-300">Import and export</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  const exported = await window.privateNotes.files.export({ format: 'json' })
                  showToast(exported ? 'Exported successfully' : 'Export cancelled', exported ? 'success' : 'info')
                }}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/25 text-sm text-zinc-300 transition hover:bg-white/10"
              >
                <Download size={16} />
                JSON backup
              </button>
              <button
                type="button"
                onClick={async () => {
                  const result = await window.privateNotes.files.import('json')
                  await loadNotes()
                  await refreshOrganization()
                  showToast(`${result.imported} note(s) imported`, 'success')
                }}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/25 text-sm text-zinc-300 transition hover:bg-white/10"
              >
                <Upload size={16} />
                Import JSON
              </button>
              <button
                type="button"
                onClick={async () => {
                  const result = await window.privateNotes.files.import('markdown')
                  await loadNotes()
                  await refreshOrganization()
                  showToast(`${result.imported} note(s) imported`, 'success')
                }}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/25 text-sm text-zinc-300 transition hover:bg-white/10"
              >
                <Upload size={16} />
                Markdown
              </button>
              <button
                type="button"
                onClick={async () => {
                  const result = await window.privateNotes.files.import('txt')
                  await loadNotes()
                  await refreshOrganization()
                  showToast(`${result.imported} note(s) imported`, 'success')
                }}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/25 text-sm text-zinc-300 transition hover:bg-white/10"
              >
                <Upload size={16} />
                TXT
              </button>
            </div>
            <button
              type="button"
              onClick={async () => {
                await window.privateNotes.backup.create()
                showToast('Backup created', 'success')
              }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/25 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              <RotateCcw size={16} />
              Backup now
            </button>
          </section>

          <section className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-300">Security</p>
            <PasswordControl />
            <label className="flex items-center justify-between rounded-lg border border-white/25 bg-zinc-950 px-3 py-3 text-sm text-zinc-300">
              Hide content in recent notes
              <input
                type="checkbox"
                checked={settings.hideRecentContent}
                onChange={(event) => void updateSettings({ hideRecentContent: event.target.checked })}
                className="accent-cyan-300"
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-white/25 bg-zinc-950 px-3 py-3 text-sm text-zinc-300">
              AES-256 encryption marker
              <input
                type="checkbox"
                checked={settings.encryptionEnabled}
                onChange={(event) => void updateSettings({ encryptionEnabled: event.target.checked })}
                className="accent-cyan-300"
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center justify-between text-sm text-zinc-300">
                Auto-lock
                <span className="text-zinc-300">{settings.autoLockMinutes} min</span>
              </span>
              <input
                type="number"
                min={1}
                value={settings.autoLockMinutes}
                onChange={(event) => void updateSettings({ autoLockMinutes: Number(event.target.value) })}
                className="h-10 w-full rounded-lg border border-white/25 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-cyan-200"
              />
            </label>
          </section>

          <section className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-300">Backup</p>
            <label className="block">
              <span className="mb-2 flex items-center justify-between text-sm text-zinc-300">
                Retention
                <span className="text-zinc-300">{settings.backupRetentionDays} days</span>
              </span>
              <input
                type="number"
                min={1}
                value={settings.backupRetentionDays}
                onChange={(event) => void updateSettings({ backupRetentionDays: Number(event.target.value) })}
                className="h-10 w-full rounded-lg border border-white/25 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-cyan-200"
              />
            </label>
          </section>

          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-300">Storage</p>
            <div className="rounded-lg border border-white/25 bg-zinc-950 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
                <Database size={16} />
                Database location
              </div>
              <p className="break-all text-xs leading-5 text-zinc-300">{settings.databaseLocation}</p>
            </div>
          </section>

          <button
            type="button"
            onClick={() =>
              void updateSettings({
                theme: 'dark',
                fontSize: 16,
                autoSaveDelay: 500,
                backupRetentionDays: 30,
                hideRecentContent: false,
                encryptionEnabled: false,
                autoLockMinutes: 10
              })
            }
            className="flex h-10 items-center gap-2 rounded-lg border border-white/25 px-3 text-sm text-white transition hover:bg-white/10 hover:text-white"
          >
            <RotateCcw size={16} />
            Reset defaults
          </button>
        </div>
      </section>
    </div>
  )
}

function CheckUpdateControl() {
  const [checking, setChecking] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const showToast = useToastStore((state) => state.showToast)

  const checkUpdate = async () => {
    setChecking(true)
    setError(null)

    try {
      const info = await window.privateNotes.updates.check()
      setUpdateInfo(info)
      showToast(info.updateAvailable ? `New version ${info.latestVersion} is available` : 'App is up to date', info.updateAvailable ? 'info' : 'success')
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Could not check for updates'
      setError(message)
      showToast(message, 'error')
    } finally {
      setChecking(false)
    }
  }

  const copyUpdateCommand = async () => {
    await navigator.clipboard.writeText('npm run update:github')
    showToast('Update command copied', 'success')
  }

  return (
    <div className="rounded-lg border border-white/25 bg-zinc-950 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-100">GitHub update</div>
          <p className="mt-1 text-xs leading-5 text-zinc-300">Check master branch for a newer app version.</p>
        </div>
        <button
          type="button"
          onClick={checkUpdate}
          disabled={checking}
          className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/25 px-3 text-sm text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={15} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Checking' : 'Check update'}
        </button>
      </div>

      {updateInfo ? (
        <div
          className={`rounded-lg border p-3 ${
            updateInfo.updateAvailable
              ? 'border-cyan-200/50 bg-cyan-300/10'
              : 'border-emerald-200/50 bg-white/[0.03]'
          }`}
        >
          <div className="flex items-start gap-2">
            {updateInfo.updateAvailable ? (
              <RefreshCw size={16} className="mt-0.5 shrink-0 text-cyan-100" />
            ) : (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-50" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-100">
                {updateInfo.updateAvailable ? 'Update available' : 'You are up to date'}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-300">
                Current {updateInfo.currentVersion} · Latest {updateInfo.latestVersion} · {updateInfo.branch}
              </p>
              {updateInfo.updateAvailable ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyUpdateCommand}
                    className="h-8 rounded-lg bg-cyan-300 px-3 text-xs font-medium text-black transition hover:bg-cyan-200"
                  >
                    Copy update command
                  </button>
                  <button
                    type="button"
                    onClick={() => void window.privateNotes.updates.openRepository()}
                    className="flex h-8 items-center gap-2 rounded-lg border border-white/25 px-3 text-xs text-zinc-300 transition hover:bg-white/10"
                  >
                    <ExternalLink size={13} />
                    Open GitHub
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex gap-2 rounded-lg border border-red-400/20 bg-red-950/80 p-3 text-xs leading-5 text-red-100">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  )
}

function PasswordControl() {
  const settings = useSettingsStore((state) => state.settings)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const showToast = useToastStore((state) => state.showToast)

  return (
    <div className="rounded-lg border border-white/25 bg-zinc-950 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
        <Lock size={16} />
        App password lock
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          placeholder={settings.passwordHash ? 'Password enabled' : 'Set password'}
          className="h-10 min-w-0 flex-1 rounded-lg border border-white/25 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-cyan-200"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const value = event.currentTarget.value
              void hashPassword(value).then(async (hash) => {
                await updateSettings({ passwordHash: hash })
                event.currentTarget.value = ''
                showToast('Password updated', 'success')
              })
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            void updateSettings({ passwordHash: null }).then(() => showToast('Password disabled', 'success'))
          }}
          className="h-10 rounded-lg border border-white/25 px-3 text-sm text-zinc-300 transition hover:bg-white/10"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

async function hashPassword(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

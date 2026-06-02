import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { getDatabasePath } from '../../database/notesRepository'

function getBackupDir(): string {
  return join(app.getPath('userData'), 'backups')
}

export function performBackup(): void {
  const backupDir = getBackupDir()
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  
  const today = new Date().toISOString().split('T')[0]
  const todayBackupDir = join(backupDir, today)
  
  if (!fs.existsSync(todayBackupDir)) {
    fs.mkdirSync(todayBackupDir, { recursive: true })
  }
  
  const dbPath = getDatabasePath()
  const backupDbPath = join(todayBackupDir, 'notes.db')
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupDbPath)
  }
}

export function deleteOldBackups(retentionDays: number): void {
  const backupDir = getBackupDir()
  if (!fs.existsSync(backupDir)) return
  
  const now = Date.now()
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000
  
  const dirs = fs.readdirSync(backupDir)
  for (const dir of dirs) {
    const dirPath = join(backupDir, dir)
    const stats = fs.statSync(dirPath)
    if (stats.isDirectory() && now - stats.mtimeMs > retentionMs) {
      fs.rmSync(dirPath, { recursive: true, force: true })
    }
  }
}

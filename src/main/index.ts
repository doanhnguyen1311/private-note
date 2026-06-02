import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import {
  createNote,
  createFolder,
  deleteFolder,
  deleteNotePermanent,
  duplicateNote,
  initDatabase,
  listFolders,
  listNotes,
  listTags,
  moveToTrash,
  restoreNote,
  updateNote
} from '../database/notesRepository.js'
import { performBackup, deleteOldBackups } from './backup/index.js'
import { getSettings, updateSettings } from './services/settingsService.js'
import { backupNow, exportData, importData } from './services/fileService.js'
import { checkForUpdates, openUpdateRepository } from './services/updateService.js'

app.disableHardwareAcceleration()

function enableAutoStart(): void {
  if (!app.isPackaged || process.platform !== 'win32') return

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false,
    name: 'Private Notes',
    path: process.execPath
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.privatenotes')
  enableAutoStart()

  initDatabase()
  const settings = getSettings()
  performBackup()
  deleteOldBackups(settings.backupRetentionDays)

  ipcMain.handle('notes:list', (_, query) => listNotes(query))
  ipcMain.handle('notes:create', (_, note) => createNote(note))
  ipcMain.handle('notes:update', (_, id, updates) => updateNote(id, updates))
  ipcMain.handle('notes:duplicate', (_, id) => duplicateNote(id))
  ipcMain.handle('notes:moveToTrash', (_, id) => moveToTrash(id))
  ipcMain.handle('notes:restore', (_, id) => restoreNote(id))
  ipcMain.handle('notes:deletePermanent', (_, id) => deleteNotePermanent(id))
  ipcMain.handle('tags:list', () => listTags())
  ipcMain.handle('folders:list', () => listFolders())
  ipcMain.handle('folders:create', (_, folderPath) => createFolder(folderPath))
  ipcMain.handle('folders:delete', (_, folderPath) => deleteFolder(folderPath))
  ipcMain.handle('backup:create', () => backupNow())
  ipcMain.handle('files:export', (event, request) =>
    exportData(request, BrowserWindow.fromWebContents(event.sender) ?? undefined)
  )
  ipcMain.handle('files:import', (event, format) =>
    importData(format, BrowserWindow.fromWebContents(event.sender) ?? undefined)
  )
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:update', (_, updates) => updateSettings(updates))
  ipcMain.handle('updates:check', () => checkForUpdates())
  ipcMain.handle('updates:openRepository', () => openUpdateRepository())

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

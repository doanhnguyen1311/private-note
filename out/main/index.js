"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");
const crypto = require("crypto");
const marked = require("marked");
const https = require("https");
let db = null;
let databasePath = "";
const starterNotes = [
  {
    title: "Welcome to Private Notes",
    content: "# Private Notes\n\nWrite securely offline with markdown preview, fast search, tags, favorites, pins, and backups.\n\n- Use `Ctrl+N` to create a note\n- Use `Ctrl+F` to search\n- Use `Ctrl+D` to duplicate\n\n| Feature | Status |\n| --- | --- |\n| Markdown | Ready |\n| Local storage | Ready |",
    tags: ["Personal", "Idea"],
    pinned: true
  },
  {
    title: "Project ideas",
    content: "Capture private ideas here. Add tags from the editor header and pin anything that needs attention.",
    tags: ["Project", "Work"]
  }
];
function getDatabasePath() {
  if (databasePath) return databasePath;
  return path.join(electron.app.getPath("userData"), "notes.db");
}
function initDatabase() {
  databasePath = getDatabasePath();
  const folder = path.dirname(databasePath);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
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
  `);
  addColumnIfMissing("folder TEXT");
  addColumnIfMissing("color_label TEXT");
  addColumnIfMissing("archived INTEGER DEFAULT 0");
  addColumnIfMissing("trashed INTEGER DEFAULT 0");
  addColumnIfMissing("deleted_at TEXT");
  const count = db.prepare("SELECT COUNT(*) as count FROM notes").get();
  if (count.count === 0) {
    starterNotes.forEach((note) => createNote(note));
  }
}
function addColumnIfMissing(definition) {
  try {
    connection().exec(`ALTER TABLE notes ADD COLUMN ${definition};`);
  } catch {
  }
}
function connection() {
  if (!db) initDatabase();
  if (!db) throw new Error("Database failed to initialize");
  return db;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function normalizeTags(tags) {
  return Array.from(
    new Set(
      (tags ?? []).map((tag) => tag.trim()).filter(Boolean)
    )
  );
}
function normalizeNullableText(value) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
function getEncryptionKey() {
  try {
    const settingsPath = path.join(electron.app.getPath("userData"), "settings.json");
    if (!fs.existsSync(settingsPath)) return null;
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (!settings.encryptionEnabled || !settings.passwordHash) return null;
    const key = Buffer.from(settings.passwordHash, "hex");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}
function encryptContent(content) {
  const key = getEncryptionKey();
  if (!key || content.startsWith("enc:v1:")) return content;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(content, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}
function decryptContent(content) {
  if (!content.startsWith("enc:v1:")) return content;
  const key = getEncryptionKey();
  if (!key) return "[Encrypted note content is locked. Enable the password to decrypt.]";
  try {
    const [, , iv, tag, encrypted] = content.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "[Encrypted note content could not be decrypted.]";
  }
}
function parseStoredTags(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return normalizeTags(parsed.filter((tag) => typeof tag === "string"));
    }
    if (typeof parsed === "string") {
      return normalizeTags(parsed.split(","));
    }
  } catch {
    return normalizeTags(value.split(","));
  }
  return [];
}
function toNote(row) {
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
  };
}
function getNoteRequired(id) {
  const row = connection().prepare("SELECT * FROM notes WHERE id = ?").get(id);
  if (!row) throw new Error(`Note not found: ${id}`);
  return toNote(row);
}
function listNotes(query = {}) {
  const rows = connection().prepare(
    `SELECT * FROM notes
       WHERE (? = 1 OR trashed = 0)
       ORDER BY pinned DESC, datetime(updated_at) DESC`
  ).all(query.includeTrash ? 1 : 0);
  const search = query.search?.trim().toLowerCase();
  const tag = query.tag?.trim().toLowerCase();
  const folder = query.folder?.trim().toLowerCase();
  const colorLabel = query.colorLabel?.trim().toLowerCase();
  let notes = rows.map(toNote);
  if (query.filter === "trash") {
    notes = notes.filter((note) => note.trashed);
  } else if (query.filter === "archive") {
    notes = notes.filter((note) => !note.trashed && note.archived);
  } else {
    notes = notes.filter((note) => !note.trashed && !note.archived);
  }
  if (query.filter === "favorites") notes = notes.filter((note) => note.favorite);
  if (query.filter === "pinned") notes = notes.filter((note) => note.pinned);
  if (query.filter === "recent") {
    notes = notes.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 50);
  }
  if (query.filter === "created") {
    notes = notes.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 50);
  }
  if (tag) {
    notes = notes.filter((note) => note.tags.some((noteTag) => noteTag.toLowerCase() === tag));
  }
  if (folder) {
    notes = notes.filter((note) => {
      const noteFolder = note.folder?.toLowerCase();
      return noteFolder === folder || noteFolder?.startsWith(`${folder}/`);
    });
  }
  if (colorLabel) {
    notes = notes.filter((note) => note.colorLabel?.toLowerCase() === colorLabel);
  }
  if (search) {
    notes = notes.filter((note) => {
      const haystack = `${note.title}
${note.content}
${note.tags.join(" ")}
${note.folder ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }
  notes = sortNotes(notes, query.sort);
  if (query.limit && query.limit > 0) {
    notes = notes.slice(0, query.limit);
  }
  return notes;
}
function sortNotes(notes, sort) {
  const copy = [...notes];
  if (sort === "title") {
    return copy.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sort === "createdAt") {
    return copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  if (sort === "favorite") {
    return copy.sort((a, b) => Number(b.favorite) - Number(a.favorite) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  if (sort === "pinned") {
    return copy.sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  return copy.sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
function createNote(input = {}) {
  const timestamp = nowIso();
  const note = {
    id: crypto.randomUUID(),
    title: input.title?.trim() || "Untitled Note",
    content: input.content ?? "",
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
  };
  connection().prepare(
    `INSERT INTO notes (
        id, title, content, tags, folder, color_label, favorite, pinned, archived, trashed, created_at, updated_at, deleted_at
      ) VALUES (
        @id, @title, @content, @tags, @folder, @colorLabel, @favorite, @pinned, @archived, @trashed, @createdAt, @updatedAt, @deletedAt
      )`
  ).run({
    ...note,
    content: encryptContent(note.content),
    tags: JSON.stringify(note.tags),
    favorite: note.favorite ? 1 : 0,
    pinned: note.pinned ? 1 : 0,
    archived: note.archived ? 1 : 0,
    trashed: note.trashed ? 1 : 0
  });
  return note;
}
function updateNote(id, updates) {
  const existing = getNoteRequired(id);
  const updated = {
    ...existing,
    title: updates.title === void 0 ? existing.title : updates.title.trim() || "Untitled Note",
    content: updates.content ?? existing.content,
    tags: updates.tags === void 0 ? existing.tags : normalizeTags(updates.tags),
    folder: updates.folder === void 0 ? existing.folder : normalizeNullableText(updates.folder),
    colorLabel: updates.colorLabel === void 0 ? existing.colorLabel : normalizeNullableText(updates.colorLabel),
    favorite: updates.favorite ?? existing.favorite,
    pinned: updates.pinned ?? existing.pinned,
    archived: updates.archived ?? existing.archived,
    trashed: updates.trashed ?? existing.trashed,
    updatedAt: nowIso(),
    deletedAt: updates.trashed === true ? nowIso() : updates.trashed === false ? null : existing.deletedAt
  };
  connection().prepare(
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
  ).run({
    ...updated,
    content: encryptContent(updated.content),
    tags: JSON.stringify(updated.tags),
    favorite: updated.favorite ? 1 : 0,
    pinned: updated.pinned ? 1 : 0,
    archived: updated.archived ? 1 : 0,
    trashed: updated.trashed ? 1 : 0
  });
  return updated;
}
function duplicateNote(id) {
  const source = getNoteRequired(id);
  return createNote({
    title: `${source.title} copy`,
    content: source.content,
    tags: source.tags,
    folder: source.folder,
    colorLabel: source.colorLabel,
    favorite: source.favorite,
    pinned: false
  });
}
function moveToTrash(id) {
  updateNote(id, { trashed: true, archived: false, pinned: false });
}
function restoreNote(id) {
  return updateNote(id, { trashed: false });
}
function deleteNotePermanent(id) {
  connection().prepare("DELETE FROM notes WHERE id = ?").run(id);
}
function listTags() {
  const tags = /* @__PURE__ */ new Set();
  listNotes({ includeTrash: false }).forEach((note) => {
    note.tags.forEach((tag) => tags.add(tag));
  });
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}
function listFolders() {
  const folders = /* @__PURE__ */ new Set();
  const rows = connection().prepare("SELECT path FROM folders ORDER BY path ASC").all();
  rows.forEach((row) => {
    normalizeFolderPath(row.path)?.split("/").forEach((_, index, parts) => folders.add(parts.slice(0, index + 1).join("/")));
  });
  listNotes({ includeTrash: false }).forEach((note) => {
    if (note.folder) {
      const parts = note.folder.split("/").map((part) => part.trim()).filter(Boolean);
      parts.forEach((_, index) => folders.add(parts.slice(0, index + 1).join("/")));
    }
  });
  return Array.from(folders).sort((a, b) => a.localeCompare(b));
}
function normalizeFolderPath(value) {
  const path2 = value?.split("/").map((part) => part.trim()).filter(Boolean).join("/");
  return path2 || null;
}
function createFolder(path2) {
  const normalized = normalizeFolderPath(path2);
  if (!normalized) throw new Error("Folder name is required");
  const timestamp = nowIso();
  const parts = normalized.split("/");
  const insert = connection().prepare("INSERT OR IGNORE INTO folders (path, created_at) VALUES (?, ?)");
  parts.forEach((_, index) => {
    insert.run(parts.slice(0, index + 1).join("/"), timestamp);
  });
  return normalized;
}
function deleteFolder(path2) {
  const normalized = normalizeFolderPath(path2);
  if (!normalized) throw new Error("Folder name is required");
  const db2 = connection();
  const transaction = db2.transaction(() => {
    db2.prepare("DELETE FROM folders WHERE path = ? OR path LIKE ?").run(normalized, `${normalized}/%`);
    db2.prepare(
      `UPDATE notes
       SET folder = NULL,
           updated_at = ?
       WHERE folder = ? OR folder LIKE ?`
    ).run(nowIso(), normalized, `${normalized}/%`);
  });
  transaction();
}
function importNotes(notes) {
  return notes.map((note) => createNote(note));
}
function exportNotesSnapshot() {
  return listNotes({ includeTrash: true });
}
function getNoteById(id) {
  return getNoteRequired(id);
}
function getBackupDir() {
  return path.join(electron.app.getPath("userData"), "backups");
}
function performBackup() {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const todayBackupDir = path.join(backupDir, today);
  if (!fs.existsSync(todayBackupDir)) {
    fs.mkdirSync(todayBackupDir, { recursive: true });
  }
  const dbPath = getDatabasePath();
  const backupDbPath = path.join(todayBackupDir, "notes.db");
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupDbPath);
  }
}
function deleteOldBackups(retentionDays) {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return;
  const now = Date.now();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1e3;
  const dirs = fs.readdirSync(backupDir);
  for (const dir of dirs) {
    const dirPath = path.join(backupDir, dir);
    const stats = fs.statSync(dirPath);
    if (stats.isDirectory() && now - stats.mtimeMs > retentionMs) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }
}
const defaults = {
  theme: "dark",
  fontSize: 16,
  autoSaveDelay: 500,
  backupRetentionDays: 30,
  passwordHash: null,
  autoLockMinutes: 10,
  hideRecentContent: false,
  encryptionEnabled: false
};
function getSettingsPath() {
  return path.join(electron.app.getPath("userData"), "settings.json");
}
function readStoredSettings() {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}
function writeStoredSettings(settings) {
  const settingsPath = getSettingsPath();
  const folder = path.dirname(settingsPath);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
}
function getSettings() {
  const stored = readStoredSettings();
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
  };
}
function updateSettings(updates) {
  const current = getSettings();
  const next = {
    ...current,
    ...updates,
    theme: updates.theme ?? current.theme,
    fontSize: Math.min(22, Math.max(13, Number(updates.fontSize ?? current.fontSize))),
    autoSaveDelay: Math.max(150, Number(updates.autoSaveDelay ?? current.autoSaveDelay)),
    backupRetentionDays: Math.max(1, Number(updates.backupRetentionDays ?? current.backupRetentionDays)),
    passwordHash: updates.passwordHash === void 0 ? current.passwordHash : updates.passwordHash,
    autoLockMinutes: Math.max(1, Number(updates.autoLockMinutes ?? current.autoLockMinutes)),
    hideRecentContent: updates.hideRecentContent ?? current.hideRecentContent,
    encryptionEnabled: updates.encryptionEnabled ?? current.encryptionEnabled,
    databaseLocation: getDatabasePath()
  };
  writeStoredSettings(next);
  return next;
}
function noteToMarkdown(note) {
  const tags = note.tags.length ? `

Tags: ${note.tags.map((tag) => `#${tag}`).join(" ")}` : "";
  return `# ${note.title}

${note.content}${tags}
`;
}
function noteToPlainText(note) {
  return `${note.title}

${note.content.replace(/[#*_`>|-]/g, " ").replace(/\s+/g, " ").trim()}`;
}
function noteToHtml(note) {
  const body = marked.marked.parse(note.content || "", { async: false });
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
</html>`;
}
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function defaultExportName(note, extension) {
  const base = note?.title.trim() || "private-notes";
  return `${base.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.${extension}`;
}
async function exportData(request, owner) {
  const note = request.noteId ? getNoteById(request.noteId) : null;
  const extension = request.format === "markdown" ? "md" : request.format;
  const options = {
    title: "Export",
    defaultPath: defaultExportName(note, extension),
    filters: [{ name: request.format.toUpperCase(), extensions: [extension] }]
  };
  const dialogOwner = owner ?? electron.BrowserWindow.getFocusedWindow();
  const result = dialogOwner ? await electron.dialog.showSaveDialog(dialogOwner, options) : await electron.dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return false;
  if (request.format === "json") {
    const payload = JSON.stringify({ exportedAt: (/* @__PURE__ */ new Date()).toISOString(), notes: exportNotesSnapshot() }, null, 2);
    fs.writeFileSync(result.filePath, payload, "utf8");
    return true;
  }
  if (!note) throw new Error("A note is required for this export format");
  if (request.format === "markdown") fs.writeFileSync(result.filePath, noteToMarkdown(note), "utf8");
  if (request.format === "txt") fs.writeFileSync(result.filePath, noteToPlainText(note), "utf8");
  if (request.format === "html") fs.writeFileSync(result.filePath, noteToHtml(note), "utf8");
  if (request.format === "pdf") {
    const pdfWindow = new electron.BrowserWindow({ show: false });
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(noteToHtml(note))}`);
    const pdf = await pdfWindow.webContents.printToPDF({ printBackground: true });
    fs.writeFileSync(result.filePath, pdf);
    pdfWindow.destroy();
  }
  return true;
}
async function importData(format, owner) {
  const options = {
    title: "Import",
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: format.toUpperCase(),
        extensions: format === "markdown" ? ["md", "markdown"] : format === "json" ? ["json"] : ["txt"]
      }
    ]
  };
  const dialogOwner = owner ?? electron.BrowserWindow.getFocusedWindow();
  const result = dialogOwner ? await electron.dialog.showOpenDialog(dialogOwner, options) : await electron.dialog.showOpenDialog(options);
  if (result.canceled) return { imported: 0 };
  const notes = [];
  for (const filePath of result.filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    if (format === "json") {
      const parsed = JSON.parse(text);
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
        });
      });
    } else {
      const title = path.basename(filePath, path.extname(filePath));
      notes.push({ title, content: text, tags: [format === "markdown" ? "Imported Markdown" : "Imported TXT"] });
    }
  }
  importNotes(notes);
  return { imported: notes.length };
}
function backupNow() {
  performBackup();
}
const REPOSITORY_URL = "https://github.com/doanhnguyen1311/private-note";
const BRANCH = "master";
const PACKAGE_JSON_URL = `${REPOSITORY_URL.replace("github.com", "raw.githubusercontent.com")}/${BRANCH}/package.json`;
async function checkForUpdates() {
  const currentVersion = electron.app.getVersion();
  const remotePackage = await fetchJson(PACKAGE_JSON_URL);
  const latestVersion = remotePackage.version;
  if (!latestVersion) {
    throw new Error("GitHub package.json does not include a version.");
  }
  return {
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    repositoryUrl: REPOSITORY_URL,
    branch: BRANCH,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function openUpdateRepository() {
  await electron.shell.openExternal(REPOSITORY_URL);
}
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 12e3 }, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        response.resume();
        reject(new Error(`GitHub responded with HTTP ${response.statusCode}.`));
        return;
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error("Update check timed out."));
    });
    request.on("error", reject);
  });
}
function compareVersions(left, right) {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}
function normalizeVersion(version) {
  return version.replace(/^v/i, "").split(/[.-]/).map((part) => Number.parseInt(part, 10)).map((part) => Number.isFinite(part) ? part : 0);
}
electron.app.disableHardwareAcceleration();
function enableAutoStart() {
  if (!electron.app.isPackaged || process.platform !== "win32") return;
  electron.app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false,
    name: "Private Notes",
    path: process.execPath
  });
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1e3,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  if (process.platform === "win32") electron.app.setAppUserModelId("com.privatenotes");
  enableAutoStart();
  initDatabase();
  const settings = getSettings();
  performBackup();
  deleteOldBackups(settings.backupRetentionDays);
  electron.ipcMain.handle("notes:list", (_, query) => listNotes(query));
  electron.ipcMain.handle("notes:create", (_, note) => createNote(note));
  electron.ipcMain.handle("notes:update", (_, id, updates) => updateNote(id, updates));
  electron.ipcMain.handle("notes:duplicate", (_, id) => duplicateNote(id));
  electron.ipcMain.handle("notes:moveToTrash", (_, id) => moveToTrash(id));
  electron.ipcMain.handle("notes:restore", (_, id) => restoreNote(id));
  electron.ipcMain.handle("notes:deletePermanent", (_, id) => deleteNotePermanent(id));
  electron.ipcMain.handle("tags:list", () => listTags());
  electron.ipcMain.handle("folders:list", () => listFolders());
  electron.ipcMain.handle("folders:create", (_, folderPath) => createFolder(folderPath));
  electron.ipcMain.handle("folders:delete", (_, folderPath) => deleteFolder(folderPath));
  electron.ipcMain.handle("backup:create", () => backupNow());
  electron.ipcMain.handle(
    "files:export",
    (event, request) => exportData(request, electron.BrowserWindow.fromWebContents(event.sender) ?? void 0)
  );
  electron.ipcMain.handle(
    "files:import",
    (event, format) => importData(format, electron.BrowserWindow.fromWebContents(event.sender) ?? void 0)
  );
  electron.ipcMain.handle("settings:get", () => getSettings());
  electron.ipcMain.handle("settings:update", (_, updates) => updateSettings(updates));
  electron.ipcMain.handle("updates:check", () => checkForUpdates());
  electron.ipcMain.handle("updates:openRepository", () => openUpdateRepository());
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});

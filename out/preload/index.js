"use strict";
const electron = require("electron");
const api = {
  notes: {
    list: (query) => electron.ipcRenderer.invoke("notes:list", query),
    create: (note) => electron.ipcRenderer.invoke("notes:create", note),
    update: (id, updates) => electron.ipcRenderer.invoke("notes:update", id, updates),
    duplicate: (id) => electron.ipcRenderer.invoke("notes:duplicate", id),
    moveToTrash: (id) => electron.ipcRenderer.invoke("notes:moveToTrash", id),
    restore: (id) => electron.ipcRenderer.invoke("notes:restore", id),
    deletePermanent: (id) => electron.ipcRenderer.invoke("notes:deletePermanent", id)
  },
  tags: {
    list: () => electron.ipcRenderer.invoke("tags:list")
  },
  folders: {
    list: () => electron.ipcRenderer.invoke("folders:list"),
    create: (path) => electron.ipcRenderer.invoke("folders:create", path),
    delete: (path) => electron.ipcRenderer.invoke("folders:delete", path)
  },
  backup: {
    create: () => electron.ipcRenderer.invoke("backup:create")
  },
  files: {
    export: (request) => electron.ipcRenderer.invoke("files:export", request),
    import: (format) => electron.ipcRenderer.invoke("files:import", format)
  },
  settings: {
    get: () => electron.ipcRenderer.invoke("settings:get"),
    update: (settings) => electron.ipcRenderer.invoke("settings:update", settings)
  },
  updates: {
    check: () => electron.ipcRenderer.invoke("updates:check"),
    openRepository: () => electron.ipcRenderer.invoke("updates:openRepository")
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("privateNotes", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.privateNotes = api;
}

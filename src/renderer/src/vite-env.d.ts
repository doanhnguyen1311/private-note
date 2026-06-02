/// <reference types="vite/client" />

import type { PrivateNotesApi } from '../../shared/types'

declare global {
  interface Window {
    privateNotes: PrivateNotesApi
  }
}

export {}

import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  tone: 'success' | 'error' | 'info'
}

interface ToastState {
  toasts: Toast[]
  showToast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (message, tone = 'success') => {
    const id = crypto.randomUUID()
    set({ toasts: [...get().toasts, { id, message, tone }] })
    window.setTimeout(() => {
      get().dismissToast(id)
    }, 2600)
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) })
  }
}))

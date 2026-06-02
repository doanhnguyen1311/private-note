import { useToastStore } from '../store/useToastStore'

export function Toasts() {
  const toasts = useToastStore((state) => state.toasts)
  const dismissToast = useToastStore((state) => state.dismissToast)

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-40 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          className={`pointer-events-auto rounded-lg border px-4 py-3 text-left text-sm shadow-2xl backdrop-blur-xl transition ${
            toast.tone === 'error'
              ? 'border-red-400/20 bg-red-950/80 text-red-100'
              : toast.tone === 'info'
                ? 'border-cyan-200/50 bg-black text-cyan-50'
                : 'border-emerald-200/50 bg-black text-emerald-50'
          }`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  )
}

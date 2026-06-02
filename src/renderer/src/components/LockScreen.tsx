import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useToastStore } from '../store/useToastStore'

interface LockScreenProps {
  passwordHash: string
  onUnlock: () => void
}

export function LockScreen({ passwordHash, onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState('')
  const showToast = useToastStore((state) => state.showToast)

  const unlock = async () => {
    const hash = await hashPassword(password)
    if (hash === passwordHash) {
      setPassword('')
      onUnlock()
    } else {
      showToast('Incorrect password', 'error')
    }
  }

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black">
      <div className="w-96 max-w-[calc(100vw-32px)] rounded-xl border border-white/25 bg-zinc-950 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-cyan-300/25 text-cyan-50">
          <Lock size={22} />
        </div>
        <h2 className="text-lg font-semibold text-zinc-50">Private Notes is locked</h2>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void unlock()
          }}
          placeholder="Password"
          className="mt-5 h-11 w-full rounded-lg border border-white/25 bg-black px-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-cyan-200"
        />
        <button
          type="button"
          onClick={() => void unlock()}
          className="mt-3 h-10 w-full rounded-lg bg-cyan-300 text-sm font-medium text-black transition hover:bg-cyan-200"
        >
          Unlock
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

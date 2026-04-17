import { useEffect } from 'react'

export type KeyBinding = {
  keys: string[]
  handler: (e: KeyboardEvent) => void
  preventDefault?: boolean
  allowInInputs?: boolean
}

const isEditable = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function useKeyboard(bindings: KeyBinding[], deps: unknown[] = []) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      for (const b of bindings) {
        if (!b.allowInInputs && isEditable(e.target)) continue
        const key = e.key.toLowerCase()
        if (b.keys.some(k => k.toLowerCase() === key)) {
          if (b.preventDefault !== false) e.preventDefault()
          b.handler(e)
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export function Kbd({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded border border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] font-mono text-[10px] font-semibold shadow-sm ${className}`}
    >
      {children}
    </kbd>
  )
}

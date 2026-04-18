import { cn } from '@/lib/utils'

export interface ChipOption<T extends string = string> {
  value: T
  label: string
  count?: number
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: ChipOption<T>[]
  value: T
  onChange: (v: T) => void
  label?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {label && <span className="text-xs text-[var(--muted-foreground)] mr-1">{label}</span>}
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors',
              active
                ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'border-[var(--border)] hover:bg-[var(--secondary)]'
            )}
          >
            {o.label}
            {typeof o.count === 'number' && (
              <span className={cn('ml-1.5 text-[10px]', active ? 'opacity-80' : 'opacity-60')}>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

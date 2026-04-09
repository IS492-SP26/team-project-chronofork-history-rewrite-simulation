import * as React from 'react'

import type { ButtonTone } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function toneColor(tone: ButtonTone) {
  switch (tone) {
    case 'observe':
      return 'var(--chrono-teal)'
    case 'intervene':
      return 'var(--chrono-amber)'
    case 'reflection':
      return 'var(--chrono-violet)'
    default:
      return 'var(--ring)'
  }
}

function textareaToneVars(tone: ButtonTone): React.CSSProperties {
  const color = toneColor(tone)
  return {
    '--textarea-border': tone === 'neutral' ? 'var(--input)' : `color-mix(in oklch, ${color} 24%, var(--border))`,
    '--textarea-hover-border': tone === 'neutral' ? 'var(--ring)' : `color-mix(in oklch, ${color} 44%, var(--border))`,
    '--textarea-focus-border': color,
    '--textarea-ring': tone === 'neutral' ? 'var(--ring)' : `color-mix(in oklch, ${color} 32%, transparent)`,
    '--textarea-bg': 'transparent',
    '--textarea-hover-bg': tone === 'neutral' ? 'transparent' : `color-mix(in oklch, ${color} 4%, transparent)`,
  } as React.CSSProperties
}

function Textarea({ className, tone = 'neutral', style, ...props }: React.ComponentProps<'textarea'> & { tone?: ButtonTone }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-[var(--textarea-border)] bg-[var(--textarea-bg)] placeholder:text-muted-foreground hover:border-[var(--textarea-hover-border)] hover:bg-[var(--textarea-hover-bg)] focus-visible:border-[var(--textarea-focus-border)] focus-visible:ring-[color:var(--textarea-ring)] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border px-3 py-2 text-base shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      style={{ ...textareaToneVars(tone), ...style }}
      {...props}
    />
  )
}

export { Textarea }

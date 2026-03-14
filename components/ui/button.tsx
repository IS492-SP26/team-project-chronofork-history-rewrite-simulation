import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

type ButtonTone = 'neutral' | 'observe' | 'intervene' | 'reflection'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-[var(--button-bg)] text-[var(--button-fg)] hover:bg-[var(--button-hover-bg)]',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-[var(--button-bg)] text-[var(--button-fg)] border-[var(--button-border)] shadow-xs hover:bg-[var(--button-hover-bg)] hover:text-[var(--button-hover-fg)] hover:border-[var(--button-hover-border)]',
        secondary: 'bg-[var(--button-bg)] text-[var(--button-fg)] hover:bg-[var(--button-hover-bg)]',
        ghost: 'bg-[var(--button-bg)] text-[var(--button-fg)] hover:bg-[var(--button-hover-bg)] hover:text-[var(--button-hover-fg)]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function toneColor(tone: ButtonTone) {
  switch (tone) {
    case 'observe':
      return 'var(--chrono-teal)'
    case 'intervene':
      return 'var(--chrono-amber)'
    case 'reflection':
      return 'var(--chrono-violet)'
    default:
      return 'var(--primary)'
  }
}

function buttonToneVars(variant: NonNullable<VariantProps<typeof buttonVariants>['variant']>, tone: ButtonTone) {
  const color = toneColor(tone)

  switch (variant) {
    case 'default':
      return {
        '--button-bg': color,
        '--button-fg': 'var(--background)',
        '--button-hover-bg': `color-mix(in oklch, ${color} 88%, black)`,
        '--button-border': color,
        '--button-hover-fg': 'var(--background)',
        '--button-hover-border': color,
      }
    case 'outline':
      return {
        '--button-bg': 'var(--background)',
        '--button-fg': tone === 'neutral' ? 'var(--foreground)' : color,
        '--button-hover-bg': tone === 'neutral' ? 'var(--accent)' : `color-mix(in oklch, ${color} 12%, transparent)`,
        '--button-border': tone === 'neutral' ? 'var(--border)' : `color-mix(in oklch, ${color} 28%, transparent)`,
        '--button-hover-fg': tone === 'neutral' ? 'var(--accent-foreground)' : color,
        '--button-hover-border': tone === 'neutral' ? 'var(--border)' : `color-mix(in oklch, ${color} 38%, transparent)`,
      }
    case 'secondary':
      return {
        '--button-bg': 'var(--secondary)',
        '--button-fg': 'var(--secondary-foreground)',
        '--button-hover-bg': tone === 'neutral' ? 'color-mix(in oklch, var(--secondary) 80%, black)' : `color-mix(in oklch, ${color} 14%, var(--secondary))`,
        '--button-border': 'var(--secondary)',
        '--button-hover-fg': tone === 'neutral' ? 'var(--secondary-foreground)' : color,
        '--button-hover-border': 'var(--secondary)',
      }
    case 'ghost':
      return {
        '--button-bg': 'transparent',
        '--button-fg': 'var(--muted-foreground)',
        '--button-hover-bg': tone === 'neutral' ? 'var(--accent)' : `color-mix(in oklch, ${color} 12%, transparent)`,
        '--button-border': 'transparent',
        '--button-hover-fg': tone === 'neutral' ? 'var(--accent-foreground)' : color,
        '--button-hover-border': 'transparent',
      }
    default:
      return {}
  }
}

function Button({
  className,
  variant,
  size,
  tone = 'neutral',
  asChild = false,
  style,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    tone?: ButtonTone
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'
  const resolvedVariant = variant ?? 'default'
  const toneVars = buttonToneVars(resolvedVariant, tone) as React.CSSProperties

  return (
    <Comp
      data-slot="button"
      data-tone={tone}
      className={cn(buttonVariants({ variant, size, className }))}
      style={{ ...toneVars, ...style }}
      {...props}
    />
  )
}

export { Button, buttonVariants, type ButtonTone }

# Architecture Notes

## Current Layering

1. `app/`
- Next.js routes and page-level composition only.
- Should not contain business state machines or transport logic.

2. `src/features/chronofork/`
- Feature module for the ChronoFork domain.
- `components/`: feature UI containers and panels.
- `state/`: reducer, types, context provider.
- `api/`: WebSocket/client transport and message routing.
- `mock/`: local mock data for non-server mode.
- `config/`: feature-specific environment config.

3. Shared UI/utility layer
- `components/ui/`: reusable presentational components (shadcn-style).
- `hooks/` and `lib/`: cross-feature shared helpers.

## Import Rules (recommended)

1. `app/*` can import from:
- `@features/*`
- shared layer (`@/components/ui/*`, `@/hooks/*`, `@/lib/*`)

2. `src/features/chronofork/*` can import from:
- same feature (`@features/chronofork/*` or relative local paths)
- shared layer (`@/components/ui/*`, `@/hooks/*`, `@/lib/*`)

3. shared layer should not import from `@features/*`.

## Why This Structure

1. Keeps domain code cohesive and easier to evolve.
2. Reduces cross-directory coupling between `src/lib` and `src/components`.
3. Makes future multi-feature expansion straightforward.

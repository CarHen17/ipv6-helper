# Memory: index.md
Updated: now

Design system and architecture for IPv6 Calculator migration from vanilla JS to React.

## Design System
- Dark navy theme (no branding tied to any specific company)
- Background: hsl(215, 50%, 8%), Cards: hsl(215, 40%, 12%)
- Primary blue: hsl(210, 100%, 50%)
- Fonts: Inter (body), JetBrains Mono (code/IPv6 addresses)
- All colors via CSS variables / semantic tokens

## Architecture
- Pure calculation logic in src/lib/ipv6-utils.ts (BigInt math preserved exactly)
- React Context for state management (useCalculatorState.tsx)
- Sidebar navigation with React Router (/, /planner, /history)
- framer-motion for animations
- xlsx package for Excel export
- ErrorBoundary wraps entire app
- Timer refs with cleanup on unmount (no race conditions)
- buildBlocksFromIndices() shared helper for aggregation

## Constraints
- No next-themes (custom useTheme hook)
- BigInt values > 2^53 must use string-based formatting, never Number()
- localStorage operations must catch errors with console.warn
- All clipboard operations must have .catch() handler
- Constants: IPV6_CONFIG.LARGE_SUBNET_THRESHOLD, IPV6_CONFIG.MAX_SUBNETS_GENERATION
- PlannerView levels use unique `id` field for React keys

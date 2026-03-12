# Memory: index.md
Updated: now

Design system and architecture for IPv6 Calculator migration from vanilla JS to React.

## Design System
- Dark navy theme matching OPEN Datacenter (core.opendata.center)
- Background: hsl(215, 50%, 8%), Cards: hsl(215, 40%, 12%)
- Primary blue: hsl(210, 100%, 50%)
- Fonts: Inter (body), JetBrains Mono (code/IPv6 addresses)
- All colors via CSS variables / semantic tokens

## Page Layout Standards
- All pages: text-xl h1 with w-5 h-5 primary icon, tracking-tight
- All pages: motion.div wrapper with fadeUp (opacity 0→1, y 16→0, 0.3s)
- Single-column pages: max-w-3xl mx-auto (Planner, EUI-64, Overlap, History)
- Calculator: max-w-[1400px] with 2-col grid (has sidebar panel)
- All pages: p-4 md:p-6 lg:p-8, mb-8 header spacing
- Info/details: hidden in collapsible <details> elements (user prefers clean UI)

## Architecture
- Pure calculation logic in src/lib/ipv6-utils.ts (BigInt math preserved exactly)
- React Context for state management (useCalculatorState.tsx)
- Sidebar navigation with React Router (/, /planner, /history)
- framer-motion for animations
- xlsx package for Excel export

## Features Migrated
- IPv6 validation, expansion, shortening (RFC 5952)
- Subnet generation with BigInt arithmetic
- Block aggregation and comparison
- Hierarchical planner with presets (ISP, Enterprise, Datacenter, Mobile)
- EUI-64 / SLAAC calculator
- Overlap/containment checker
- History with localStorage persistence
- Export (CSV, TXT, JSON, Excel)
- Reverse search
- IP generation (50 per batch)

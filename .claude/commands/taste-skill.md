# Design Taste Frontend: Senior UI/UX Engineering System

This comprehensive guide establishes high-agency frontend architecture for building premium digital interfaces that counter default LLM biases.

## Core Configuration

Three baseline dials control all design decisions:
- **Design Variance: 8** (ranges 1-10, from perfect symmetry to artsy chaos)
- **Motion Intensity: 6** (from static to cinematic physics)
- **Visual Density: 4** (from gallery-sparse to cockpit-packed)

Users can override these values dynamically through explicit requests.

## Key Technical Mandates

**Dependency Verification:** Always check `package.json` before importing third-party libraries and output installation commands when packages are missing.

**Framework Requirements:** React/Next.js with Server Components as default. Global state exclusively in `"use client"` wrapped providers. Interactivity must isolate in leaf components.

**Styling Standard:** Tailwind CSS (v3/v4) for 90% of styling. Never use emojis—replace with Phosphor or Radix icons instead.

**Responsiveness Rule:** Use `min-h-[100dvh]` instead of `h-screen` to prevent mobile layout collapse. Employ CSS Grid over complex flexbox calculations.

## Design Engineering Rules (Bias Correction)

The system enforces six deterministic rules to eliminate common AI clichés:

1. **Typography Specificity:** Headlines use `text-4xl md:text-6xl tracking-tighter`. Ban "Inter" for premium vibes; use "Geist," "Outfit," or "Cabinet Grotesk" instead.

2. **Color Calibration:** Maximum one accent color with saturation under 80%. The "AI Purple" aesthetic is strictly forbidden.

3. **Layout Diversification:** "Centered Hero sections are strictly BANNED when LAYOUT_VARIANCE > 4." Force asymmetric arrangements.

4. **Anti-Card Overuse:** For high visual density, eliminate generic card containers; use borders and negative space instead.

5. **Interactive States:** Mandatory implementation of loading, empty, error states, and tactile feedback (e.g., `-translate-y-[1px]` on active).

6. **Data Patterns:** Labels sit above inputs with helper and error text below.

## Forbidden AI Patterns

The guide explicitly bans:
- Neon/outer glows, pure black, oversaturated accents, gradient text
- "Inter" font, oversized H1s, serif on dashboards
- Generic names ("John Doe"), fake numbers (99.99%), startup clichés ("Nexus")
- Broken Unsplash links, default shadcn/ui styling

## Motion & Performance

**Perpetual Micro-Interactions:** When `MOTION_INTENSITY > 5`, embed infinite animations using Framer Motion's `useMotionValue` and `useTransform` to avoid performance collapse.

**Hardware Acceleration:** Never animate `top`, `left`, `width`, `height`—only `transform` and `opacity`.

**Z-Index Restraint:** Use z-indexes strictly for systemic layers (navbars, modals), not arbitrarily.

## The Bento 2.0 Paradigm

Modern dashboards must feature:
- High-end minimal aesthetic with `#f9fafb` backgrounds and white cards (`border-slate-200/50`)
- `rounded-[2.5rem]` containers with diffusion shadows
- **Perpetual micro-interactions** using spring physics (`stiffness: 100, damping: 20`)
- Five card archetypes: Intelligent List, Command Input, Live Status, Wide Data Stream, Contextual UI

## Pre-Flight Checklist

Before outputting, verify:
- Global state avoids arbitrary prop-drilling
- Mobile collapse guaranteed for high-variance designs
- Full-height sections use `min-h-[100dvh]`
- `useEffect` animations include cleanup functions
- Empty/loading/error states provided
- Cards omitted where spacing suffices
- Perpetual animations isolated in dedicated Client Components

This system prioritizes **production-ready cleanliness**, metric-driven design, and systematic bias correction over generic AI outputs.

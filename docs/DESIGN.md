# Design System

## Style
Dark, polished developer-tool aesthetic — closer to an infrastructure monitoring dashboard (think observability/status-page tools) than a chatbot or a consumer eco-app. Water/sustainability theme comes through in accent color and iconography, not in a "green marketing site" visual language.

## Typography
Inter for UI text; a monospace font (`"JetBrains Mono", "SF Mono", monospace`) for the pipeline diagram, token counts, and resource numbers — reinforces the "infrastructure telemetry" feel and makes numbers easy to scan.

## Colors — Dark Theme (primary, default)
- Background: `#0B1120`
- Surface (cards/panels): `#161E2E`
- Surface elevated (active pipeline stage): `#1E293B`
- Text: `#F1F5F9`
- Muted text: `#94A3B8`
- Primary/accent (water): `#22D3EE`
- Primary hover: `#67E8F9`
- Border: `#293548`
- Small-tier tag: `#0F3D2E` bg / `#4ADE80` text
- Large-tier tag: `#3D1F1F` bg / `#F87171` text
- Cached tag: `#1E293D` bg / `#60A5FA` text
- Status-online green: `#4ADE80`
- Status-offline/error red: `#F87171`

## Colors — Light Theme (secondary, optional toggle)
- Background: `#F8FAFC`
- Surface: `#FFFFFF`
- Text: `#0F172A`
- Muted text: `#64748B`
- Primary: `#0891B2`
- Border: `#E2E8F0`
- Tag colors: same hue mapping as dark theme, light backgrounds

## Buttons
- Primary — filled, primary color, white text (Send, Export)
- Secondary — outlined, primary color border (Compare Mode toggle, Settings)
- Destructive — red outline (Clear history)
- All buttons: 8px border radius, visible focus ring for keyboard nav

## Cards
- Border radius: 10px
- Subtle border (`1px solid` border color) rather than heavy shadow
- Response cards and history entries share the same card style for visual consistency

## Tags (tier labels)
- Pill-shaped, 4px/10px padding, bold, small caps text
- Always paired with a receipt line underneath — a tag alone without its resource cost defeats the point of the product

## Layout
- Dashboard layout, wider than a chat app: pipeline visualization + status indicators as a persistent header strip; prompt input and current-request panel (decision card, live resource meter, cache status) as the main focus; session analytics/timeline as a sidebar or lower panel on desktop, stacked below on mobile
- Pipeline diagram: horizontal row of stages on desktop, condenses to a vertical stack or dot-progress indicator on mobile — the current-stage highlight must remain legible at both sizes
- Recent request timeline: collapsible sidebar or bottom drawer, not always expanded (avoid crowding the current-request focus)
- Benchmark Mode: visually separated panel (different background/border treatment) so it's never mistaken for live session data
- Tier 3 Compare Mode (if built): two response cards side by side on desktop, stacked on mobile

## UX Requirements
- Mobile responsive (single column below 640px, Compare Mode stacks)
- Loading state on every async action (sending a prompt, exporting, toggling compare mode)
- Empty state for history panel before any queries exist ("No queries yet — ask something to get started")
- Error state if the Gemini API call fails or rate-limits (clear message, not a raw stack trace)
- Every interactive control (toggle, slider, button) has a visible label — no icon-only controls without a text label or tooltip
- Keyboard-navigable: Enter submits the prompt input, Tab order follows visual order

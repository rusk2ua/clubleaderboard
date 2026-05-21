# Club Contest Award Scoring System - Design Guidelines

## Design Approach

**Selected Approach: Utility-First Design System**

This is a data-intensive scoring application for a technical community. The design prioritizes clarity, efficiency, and information density over visual embellishment. Drawing inspiration from modern developer dashboards (Linear, GitHub, Vercel) that excel at presenting complex data clearly.

**Core Principles:**
- Information hierarchy over decoration
- Scannable data tables and forms
- Consistent, predictable interactions
- Professional technical aesthetic
- Accessibility and readability first

---

## Color Palette

**Dark Mode Primary (Default):**
- Background Base: 222 15% 8%
- Surface: 222 15% 12%
- Surface Elevated: 222 15% 16%
- Border: 222 10% 24%
- Text Primary: 222 5% 95%
- Text Secondary: 222 5% 65%
- Accent Blue: 215 85% 58%
- Success Green: 145 70% 52%
- Error Red: 0 75% 60%

**Light Mode (Secondary):**
- Background Base: 0 0% 98%
- Surface: 0 0% 100%
- Border: 222 10% 88%
- Text Primary: 222 15% 15%
- Text Secondary: 222 10% 45%
- Accent Blue: 215 75% 48%

---

## Typography

**Font Stack:**
- Primary: Inter (via Google Fonts CDN)
- Monospace: JetBrains Mono (for callsigns, scores, technical data)

**Type Scale:**
- Display: 2.5rem (40px) / font-bold - Page titles
- Heading 1: 2rem (32px) / font-semibold - Section headers
- Heading 2: 1.5rem (24px) / font-semibold - Card titles
- Heading 3: 1.25rem (20px) / font-medium - Table headers
- Body: 1rem (16px) / font-normal - Primary text
- Small: 0.875rem (14px) / font-normal - Labels, metadata
- Mono: 0.875rem (14px) / font-mono - Callsigns, scores

---

## Layout System

**Spacing Primitives:**
Use Tailwind units: 2, 4, 6, 8, 12, 16, 24 for consistent rhythm
- Tight spacing: p-2, gap-2 (inputs, buttons)
- Standard spacing: p-4, gap-4 (cards, sections)
- Generous spacing: p-8, p-12 (page margins)
- Section breaks: mb-16, mb-24

**Container Strategy:**
- Max width: max-w-7xl (1280px) for main content
- Data tables: Can expand to max-w-full with horizontal scroll
- Forms: max-w-2xl for optimal completion
- Admin panels: max-w-6xl

---

## Component Library

### Navigation
- **Top Navigation Bar**: Fixed header with logo, main nav links, user menu
  - Height: h-16
  - Background: Surface color with border-b
  - Sticky positioning for scroll persistence
  - User avatar/callsign in top-right

### Data Display

**Scoreboard Tables:**
- Striped rows for scanability (even rows slightly lighter background)
- Sticky header rows during scroll
- Mono font for callsigns and numerical scores
- Rank column: Bold, accent color for top 3
- Claimed vs Normalized scores: Side-by-side columns with clear labels
- Hover state: Subtle background highlight
- Responsive: Stack to cards on mobile (<768px)

**Stat Cards:**
- Background: Surface elevated
- Border: 1px subtle
- Padding: p-6
- Large number display: 3rem mono font
- Label below: text-sm text-secondary

**Contest/Member Detail Cards:**
- White/dark card with rounded-lg borders
- Header with contest name/callsign (H2 size)
- Divider between header and content
- Metadata row: Grid of key-value pairs (text-sm)

### Forms

**Upload Form:**
- Drag-and-drop zone: Dashed border, h-48, centered icon and text
- File input button: Primary accent color
- Email input: Full-width, clearly labeled
- Submit button: Prominent, w-full on mobile, w-auto on desktop
- Validation states: Red border + error message below field

**Admin Forms:**
- Two-column layout on desktop (label left, input right)
- Clear section grouping with subtle dividers
- Helper text: text-sm text-secondary below inputs
- Action buttons: Right-aligned, primary + ghost secondary

### Interactive Elements

**Buttons:**
- Primary: bg-accent (blue), rounded-md, px-6 py-2.5
- Secondary: border-2 border-accent, transparent bg
- Danger: bg-error (red) for destructive actions
- Ghost: No border, hover:bg-surface-elevated
- Icon buttons: p-2, rounded-md

**Status Badges:**
- Accepted: Green background with dark green text
- Rejected: Red background with dark red text
- Processing: Yellow/amber with dark text
- Pill shape: rounded-full, px-3 py-1, text-xs font-medium

### Overlays

**Modals:**
- Backdrop: Semi-transparent dark overlay
- Modal: max-w-2xl, bg-surface, rounded-lg
- Header: Borderless title with close X button
- Content: p-6
- Footer: Border-top, right-aligned actions

**Toasts/Notifications:**
- Fixed bottom-right positioning
- Auto-dismiss after 5s
- Color-coded by type (success green, error red, info blue)
- Max-width: 24rem

---

## Page-Specific Layouts

### Public Scoreboard (/)
- Hero section: h-64, gradient background (subtle), centered title and season info
- Quick stats: 3-4 stat cards in grid (grid-cols-1 md:grid-cols-4)
- Leaderboard table: Full-width, top 50 members
- Contest quick links: Grid of contest badges linking to detail pages

### Upload Page (/upload)
- Centered form: max-w-2xl
- Clear instructions above form
- File dropzone prominent
- Email field below
- Recent submissions list (if logged in) in sidebar or below

### Member Detail (/members/[call])
- Header card: Callsign (large mono), total points, rank
- Contest participation table: All contests entered with scores
- Charts (future): Simple bar chart of normalized points by contest

### Contest Detail (/contests/[key])
- Header: Contest name, mode badge, date, participant count
- Baseline info card: Highest single-op score highlighted
- Full results table: All participants with individual and normalized scores

### Admin Dashboard (/skipper)
- Sidebar navigation: Submissions, Members, Settings
- Main content area: Data tables with inline actions
- Bulk action toolbar when items selected
- Status filter chips above tables

---

## Images

**No large hero images required** - This is a data-focused utility application. Use subtle gradient backgrounds for visual interest instead.

**Icon Usage:**
- Heroicons (outline style) via CDN for UI icons
- Upload icon, trophy icon, chart icons, settings gear
- Status indicators (checkmark, X, clock)

---

## Animations

**Minimal, purposeful only:**
- Table row hover: Smooth 150ms background transition
- Button hover: 200ms background/border transition
- Modal entrance: 200ms fade + slight scale
- Toast slide-in: 300ms from bottom-right
- No scroll animations, parallax, or decorative motion

---

## Accessibility Notes

- All form inputs with associated labels
- Table headers with proper scope
- Focus visible states: 2px accent color ring
- Contrast ratios exceed WCAG AA (4.5:1 minimum)
- Dark mode as default with light mode toggle in user menu
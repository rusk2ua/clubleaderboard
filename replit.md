# Club Contest Award Scoring System

## Overview
The Club Awards Program is an automated scoring system for the Yankee Clipper Contest Club's ham radio contests. It processes Cabrillo log files, validates club membership, calculates normalized scores based on contest performance and DX cluster spotting activity (Cheerleader Points), and displays results on live and historical leaderboards. The system aims to provide a professional, data-focused platform for tracking Club Award Points, combining Contest Points and Cheerleader Points for a comprehensive view of member performance.

## User Preferences
- **Default theme**: Dark mode (set in ThemeProvider)
- **Design**: Data-focused, minimal UI, info-dense tables, professional ham radio aesthetic
- **Font**: Inter (UI), JetBrains Mono (callsigns, scores)
- **Color scheme**: Blue primary, muted backgrounds, professional data display

## System Architecture

### Stack
- **Frontend**: React + Vite, TailwindCSS, Shadcn UI, Wouter, TanStack Query
- **Backend**: Express.js, PostgreSQL (Neon), Drizzle ORM
- **File Processing**: Multer, PapaParse

### Technical Implementations
- **Cabrillo Log Processing**: Parses Cabrillo files for contest, callsign, score, operators, club, and mode. Supports dynamic contest year parsing from QSO dates.
- **Dues Validation & Inclusive Scoring**: Validates operator dues against a roster; only operators with current dues are scored.
- **Configurable Scoring System**: Administrators can choose between "Fixed" (fixed 1M max points) or "Participant-Based" (dynamic max based on logs, capped at 1M) normalized scoring methods.
- **Scoring Engine**: Calculates Club Award Points by normalizing individual claimed scores against a dynamic reference baseline (highest individual claimed score) and combining with Cheerleader Points. All points are rounded to whole numbers.
- **Duplicate Submission Handling**: Ensures only the latest submission for a given callsign, contest, and year is active.
- **Dense Ranking**: Leaderboards use dense ranking for ties.
- **Perpetual Scoring**: Provides current season and all-time aggregated leaderboards.
- **Multiple File Upload**: Supports simultaneous upload of multiple Cabrillo logs.
- **Admin Functionality**: Features for syncing member roster and clearing contest data.
- **Interactive Insights**: Homepage displays "Most Recent Logs", "Most Active Operators", "Most Competitive Contests", and "Top Cheerleaders" with achievement icons and clickable links to detailed pages.
- **Real-Time Updates**: WebSocket-based live updates for new log uploads and roster syncs.
- **Automatic Daily Roster Sync**: Scheduler syncs member roster from YCCC website daily.
- **Email Confirmations**: Optional HTML email confirmations for successful log submissions.
- **Performance Optimizations**: Implemented database indexing, N+1 query elimination, batch operations, and optimized baseline computations to enhance system performance and stability.
- **Leaderboard Data Integrity**: Ensures leaderboard queries only include operator points from active submissions.
- **Cheerleader Points System**: Monitors DX telnet clusters, awards configurable points when eligible members spot other club members, and integrates these points into leaderboards. Includes callsign normalization to handle portable/DX prefix formats (e.g., N2WQ/1, V47/K5ZD, LZ/K1XM/p).

### UI/UX Decisions
- **Layout**: Clean, minimal design with tabs for All-Time (default), Current Year, and Historical leaderboards.
- **Information Density**: Focuses on clear data display, with clickable elements for detailed views.
- **Branding**: "Club Awards Program" with a professional ham radio aesthetic.
- **Homepage Cards**: Four insight cards with top 5 entries, achievement icons, and relevant stats, adapting to screen sizes.
- **Achievement Icons**: Gold trophy, medal, and star icons indicate Elite Performer, High Achiever, and Runner Up tiers based on all-time YCCC points, with an accompanying legend.

### Database Schema
- `members`: Callsign, active status, aliases, names, dues expiration.
- `submissions`: Contest metadata, claimed scores, operators, mode, status.
- `raw_logs`: Original Cabrillo file content.
- `baselines`: Highest single-claimed score per contest/year.
- `operator_points`: Individual and normalized points for each scored member operator.
- `cheerleader_points`: Cumulative cheerleader points per member per season.
- `scoring_config`: Key-value configuration for scoring method and DX cluster settings.

## External Dependencies
- **PostgreSQL (Neon)**: Primary database.
- **yccc.org/roster/**: Source for club member roster synchronization.
- **DX Cluster (Telnet)**: Monitors spot messages (default: dxc.w6cua.org:7300).
- **Gmail API (via Replit connector)**: Sends log submission confirmation emails.
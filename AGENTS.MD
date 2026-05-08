# Project Specification

Monitor Legislativ (Romanian Civic Tech)

## Project Objective

Web application to track the legislative process in Romania by scraping data from cdep.ro and senat.ro. The app parses legislative metadata, track the chronological status of laws, and record individual voting data for parliament members.


## Tech stack

- backend: hono + drizzle
- frontend: react / vue
- scraper: Cheerio
- database: postgresql

## Hosting

Target: 0-cost scale to 0, don't want any unexpected huge bills.

- backend: cloudflare workers
- frontend: cloudflare pages / github pages
- scraper: github actions
- database: Neon


## Backend

Location: ./backend/

### Schema Design

PostgreSQL schema using Drizzle.

### Tables

- laws: ID, title, registration_number (e.g., L123/2024), current_status, chamber (Senat/CDEP), and original_url.
- status_history: law_id, status_label, location (which commission/plenary), and timestamp.
- members: name, party, chamber, and photo_url.
- votes: law_id, member_id, vote_value (Yes/No/Abstain/Absent), and vote_date.

### API Routes

Hono routes to:

- POST /sync/law: Upsert a law and its status history.
- POST /sync/vote: Record individual member votes.
- GET /laws: List laws with filters (status, chamber).
- GET /laws/:id: Detailed view including status timeline and vote breakdown.

### The Contract 

Strict TypeScript Interface for the `LegislativeJSON` format. This interface will be the single source of truth that the scraper and frontend will use.

LegislativeJSON lives in ./backend/src/types.ts

### Edge Compatibility

Ensure all code is compatible with Cloudflare Workers.


## Scraper

Location: ./scraper/

### Extraction logic

Parse the registration number, title, and the chronological list of events (the "Traseu legislativ").

Handle Romanian character encoding (UTF-8) and date parsing (e.g., "12 oct. 2024").

Extract voting PDF links or HTML tables where individual MP votes are recorded.

### Output

Must transform scraped data into the `LegislativeJSON` format defined by the `Backend`.

### Reliability

Basic error handling for when the government website goes down or changes its HTML structure.

### Execution

Script in a format suitable for a GitHub Action that runs on a schedule (cron).

## Frontend

Location: ./frontend/

### UI/UX

Clean, mobile-first interface. Use a "Timeline" component to show the progress of a law through the legislative chambers.

### Data Fetching

Use TanStack Query (React Query) to fetch data from the Hono API.

### Features

- Search/Filter: Allow users to search by law title or filter by status (e.g., "In Promulgare").

- MP Profiles: A simple view showing how a specific MP has voted on recent bills.

- Visual Cues: Use colors (Green/Yellow/Red) to signify the progress or "danger" of a bill.

- Performance: Ensure the app is lightweight for Cloudflare Pages. Use Lucide-react for icons.
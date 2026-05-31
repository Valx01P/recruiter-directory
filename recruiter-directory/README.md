# Tech Recruiter Directory

Simple, fast, client-side searchable directory for US tech company recruiters (focus: university / early-career / SWE & AI interns).

Built to power LinkedIn outreach from the `job/recruiter.json` dataset.

## Features
- Full-text search across companies + every recruiter field (name, title, location, notes, focus)
- Priority filters (P1 = top targets like NVIDIA/OpenAI)
- "Only companies with recruiters" toggle (default ON — shows the populated ones first)
- Category quick-filters
- Per-company:
  - Direct **Company LinkedIn** link
  - **"Find more recruiters"** → opens the pre-built LinkedIn People search (`recruiter_search_url`) — the #1 way to harvest fresh profiles
  - All individual recruiter LinkedIn profiles open in new tabs
  - One-click **Copy URL** + big **Message** button per recruiter
- Export button → downloads CSV of every populated recruiter (great for spreadsheets / your CRM)
- Stats, last-updated, and workflow link in header
- Dark mode friendly, keyboard accessible, mobile responsive

## Quick Start (Local)

```bash
cd recruiter-directory
npm install
npm run dev
```

Open http://localhost:3000

The app consumes `data/recruiter.json` (copied from `../job/recruiter.json` at setup time).

## Keeping Data in Sync

Whenever you add recruiters to `job/recruiter.json`:

```bash
# From repo root
cp job/recruiter.json recruiter-directory/data/recruiter.json
cp job/recruiter.json recruiter-directory/public/data/recruiter.json

# Then (optional) rebuild
cd recruiter-directory && npm run build
```

Or create a tiny script at root:

```bash
#!/bin/bash
cp job/recruiter.json recruiter-directory/data/recruiter.json
cp job/recruiter.json recruiter-directory/public/data/recruiter.json
echo "Synced recruiter.json → UI"
```

## Populating More Recruiters

See the root workflow file:

```
job/RECRUITER_WORKFLOW.md
```

Recommended order: finish all 39 P1 companies (currently 7 seeded with 26 real profiles), then P2.

The UI makes it obvious which companies still need work (they show a "No recruiters yet — use search link" callout + the magic "Find more recruiters" button).

## Deployment

This is a static Next.js app (no backend). Deploy anywhere:

- Vercel (easiest): `vercel --prod`
- GitHub Pages / Cloudflare Pages / Netlify (after `npm run build` + output `out/` if you enable static export)
- The entire recruiter list + search is client-side after initial load.

## Notes / Credits

- JSON schema and initial 1251 companies curated by Pablo Valdes.
- Initial 26 recruiters (NVIDIA 6, Apple 4, Meta 4, Microsoft 3, OpenAI 4, Anthropic 3, Google 2) added via public web + LinkedIn search May/June 2026.
- Always double-check that a profile is still current before sending InMail.
- This is a personal tool — respect LinkedIn limits and recruiter time.

Last sync: see `job/recruiter.json` meta.last_updated

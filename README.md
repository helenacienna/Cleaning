# Cienna Cleaning Platform

Operational cleaning management platform for the Cienna suite.

## Stack
- Next.js 14
- React 18
- Railway-ready Node deployment

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Railway
- Create a new Railway project
- Point it at this folder/repo
- Railway will detect the Next.js app
- Start command: `npm run start`

## ShiftRun Google Calendar mirror
- Dry run: `npm run ops:calendar:shiftruns:dry-run -- --json`
- First live commit: `npm run ops:calendar:shiftruns:commit -- --json --allow-bootstrap`
- Ongoing commits after bootstrap: `npm run ops:calendar:shiftruns:commit -- --json`
- Docs: `docs/shift-run-google-calendar-sync.md`

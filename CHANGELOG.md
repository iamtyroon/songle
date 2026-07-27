# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Netlify production deployment at [play-songle.netlify.app](https://play-songle.netlify.app)
- `firebase.json` and `.firebaserc` for Firestore rules deployment (`npx firebase-tools deploy --only firestore:rules`)
- Project README with setup, architecture, and security documentation

### Changed

- Preset song list simplified to plain iTunes search terms; Spotify links now derive from iTunes results instead of hardcoded IDs

### Removed

- Unused planning files `src/data/firebaseSchema.ts` and `src/data/nextjsStructure.ts`
- Unused `fetchSongsFromiTunes` helper and dead Firebase imports
- Unused dependencies: `express`, `dotenv`, `@google/genai`, `tsx`, `@types/express`, `esbuild`, `autoprefixer`
- `GEMINI_API_KEY` from `.env.example` (never referenced)

### Fixed

- Broken "Play on Spotify" links caused by invented Spotify track IDs in presets

### Security

- Firestore rules hardened: scores are immutable once written, limited to one per user per day via enforced `{uid}_{date}` document IDs, and bounded to the legitimate 0–600 range to block client-side score tampering
- Profile self-deletion allowed so account deletion works end to end
- `firebase-applet-config.json` removed from the repository and purged from git history; ignored going forward

## [0.1.0] - 2026-07-27

### Added

- Core Heardle-style daily music guessing game: 6 attempts with progressively longer snippets (1s–16s)
- iTunes Search API integration for 30-second audio previews
- Firebase authentication: Google, Twitter/X, GitHub, email/password, and anonymous guest sessions with account upgrade
- Global leaderboard ranked by points, backed by Firestore
- Scoring: `(6 - attempts) * 100 + speed bonus`, with daily win streaks
- Offline support via Firestore persistent local cache and localStorage stat fallback

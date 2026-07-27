# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Favicon, apple-touch-icon, and `theme-color`, all driven by `logo.svg`
- Page `<title>` and meta description, plus Open Graph and Twitter card tags with a 1200×630 preview image (`public/og.png`) so shared links render a card instead of a bare URL
- `public/logo.svg`: a scalable mark built from the waveform motif — solid bars for the snippet you have heard, faded bars for the track still locked. Used in the README and as the app header and footer mark, replacing the generic music-note icon (Vite inlines it as a data URI, so it costs no extra request)
- Netlify production deployment at [play-songle.netlify.app](https://play-songle.netlify.app)
- `firebase.json` and `.firebaserc` for Firestore rules deployment (`npx firebase-tools deploy --only firestore:rules`)
- Project README with setup, architecture, and security documentation

### Changed

- Play area consolidated: the sound-wave visualizer, 6-segment progress bar, and elapsed-time readout are now a single waveform timeline showing the unlocked window, snippet tier marks, and a playhead
- Guess result chips show the guessed artist, album, and genre values instead of the uninformative "Wrong Artist"/"Wrong Album" labels
- Motion reworked: removed five always-running ambient animations; added an album-art defocus reveal on game over and entrance motion on new guess rows; all Framer Motion now honors `prefers-reduced-motion` via `MotionConfig`
- Typography changed from Inter/Space Grotesk to Archivo/Syne
- Interface copy rewritten in plain language (e.g. "CURRENT TIME COORDINATES" is now the date itself)
- Stats and leaderboard cards flattened; nested card containers and icon-badge headers removed
- Preset song list simplified to plain iTunes search terms; Spotify links now derive from iTunes results instead of hardcoded IDs
- Dev server no longer hardcodes port 3000; `PORT` is honored when set
- README screenshot recaptured against the current interface; feature list updated to describe the waveform timeline and guess feedback
- Logo and screenshot moved into `public/` so the same files serve the app, the favicon, and the README (`scrnshot.png` is now `public/screenshot.png`)

### Removed

- Unused planning files `src/data/firebaseSchema.ts` and `src/data/nextjsStructure.ts`
- Unused `fetchSongsFromiTunes` helper and dead Firebase imports
- Unused dependencies: `express`, `dotenv`, `@google/genai`, `tsx`, `@types/express`, `esbuild`, `autoprefixer`
- `GEMINI_API_KEY` from `.env.example` (never referenced)

### Fixed

- Broken "Play on Spotify" links caused by invented Spotify track IDs in presets
- Guess-distribution rows with a count of zero rendered a visible bar stub
- Hint row overlapped its own text below 400px; help modal title collided with the close button at 320px
- Missing `fadeIn` keyframes meant the `animate-fadeIn` class silently did nothing
- Keyboard focus was invisible on most controls; a global `:focus-visible` ring now applies
- Sign-in failed on the deployed site with `auth/unauthorized-domain`: `play-songle.netlify.app` and `localhost` were missing from the Firebase Authentication authorized-domains list (a console/API setting, not a code change)

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

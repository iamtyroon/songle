<a name="readme-top"></a>

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![Twitter][twitter-shield]][twitter-url]

<br />
<div align="center">
  <a href="https://github.com/iamtyroon/songle">
    <img src="public/logo.svg" alt="Songle Logo" width="80" height="80">
  </a>

  <h3 align="center">Songle</h3>

  <p align="center">
    An elegant, high-fidelity daily music discovery game built with React, Tailwind CSS, and Firebase.
    <br />
    <a href="https://github.com/iamtyroon/songle"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/iamtyroon/songle">View Demo</a>
    ·
    <a href="https://github.com/iamtyroon/songle/issues">Report Bug</a>
    ·
    <a href="https://github.com/iamtyroon/songle/issues">Request Feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#architecture-layout-details">Architecture Layout Details</a></li>
    <li><a href="#security-warnings">Security Warnings</a></li>
    <li><a href="#testing-suite--benchmarks">Testing suite & Benchmarks</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li>
      <a href="#contributing">Contributing</a>
      <ul>
        <li><a href="#contribution-guidelines">Contribution Guidelines</a></li>
      </ul>
    </li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

## About The Project

[![Songle Screen Shot][product-screenshot]](https://github.com/iamtyroon/songle)

Songle is a modern, responsive daily music guessing game inspired by Heardle. Players listen to progressively longer snippets of a daily curated song (1s, 2s, 4s, 7s, 11s, and 16s) and attempt to identify the correct track title and artist in as few attempts as possible. 

### Key Features
* **Dynamic Audio Previews**: Powered by the iTunes Search API to stream high-quality 30-second audio clips seamlessly.
* **Robust Authentication**: Supports Google, Twitter/X, GitHub, Email/Password, and instant Guest/Anonymous sessions.
* **Seamless Account Upgrades**: Guest players can link an email and password at any time to preserve their stats, streaks, and leaderboard positions.
* **Real-time Leaderboards**: Global high-score tracking with atomic transaction-based score submissions.
* **Offline Resilience**: Configured with Firestore persistent local cache and multi-tab state synchronization.
* **Waveform Timeline**: A single track view carries the unlocked listening window, the snippet tier marks, and the playhead — no separate progress bar or timer to reconcile.
* **Informative Guesses**: Each wrong guess reports the artist, album, genre, and release year you actually picked, with an arrow pointing toward the answer's year.
* **Modern UI/UX**: Bento Grid layout, Archivo/Syne typography, and motion that respects `prefers-reduced-motion`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![React][React.js]][React-url]
* [![Vite][Vite.dev]][Vite-url]
* [![TailwindCSS][TailwindCSS.com]][Tailwind-url]
* [![Firebase][Firebase.google.com]][Firebase-url]
* [![TypeScript][TypeScriptlang.org]][TypeScript-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Ensure you have Node.js (v18 or higher) and npm installed on your machine.
* npm
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/iamtyroon/songle.git
   cd songle
   ```
2. Install the dependencies:
   ```sh
   npm install
   ```
3. Configure your environment variables. Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
   APP_URL="http://localhost:3000"
   ```
4. Add your Firebase configuration file. Save your Firebase Web App configuration JSON as `firebase-applet-config.json` in the root directory:
   ```json
   {
     "apiKey": "YOUR_API_KEY",
     "authDomain": "YOUR_AUTH_DOMAIN",
     "projectId": "YOUR_PROJECT_ID",
     "storageBucket": "YOUR_STORAGE_BUCKET",
     "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
     "appId": "YOUR_APP_ID",
     "firestoreDatabaseId": "(optional)"
   }
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

### Running the Development Server
Start the local Vite development server on port `3000`:
```sh
npm run dev
```

### Building for Production
Compile the optimized production build:
```sh
npm run build
```

### Previewing the Production Build
Locally preview your production build:
```sh
npm run preview
```

### Scoring Mechanics
Scores are calculated dynamically upon a successful guess using the following formula:
$$\text{Score} = (6 - \text{attempts used}) \times 100 + \text{speed bonus}$$
* **Maximum Base Score**: 500 points (won on the 1st attempt).
* **Speed Bonus**: Calculated based on how quickly the user submits their correct guess after starting the audio.
* **Streak Multiplier**: Consecutive daily wins increment the user's active streak, which is displayed on the global leaderboard.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Architecture Layout Details

The codebase is structured to support both the current single-page application (SPA) architecture and a planned migration to a full-stack Next.js App Router setup.

### Current SPA Directory Structure
```
├── src/
│   ├── components/
│   │   ├── AccountSettingsModal.tsx   # Profile, security, and account upgrade management
│   │   ├── AuthModal.tsx              # Social & Email authentication portal
│   │   └── SongleGame.tsx             # Core gameplay loop and audio controller
│   ├── data/
│   │   ├── firebaseSchema.ts          # Firestore collections, rules, and indexes
│   │   ├── nextjsStructure.ts         # Next.js App Router migration blueprint
│   │   └── songs.ts                   # iTunes search utilities and fallback tracks
│   ├── lib/
│   │   └── firebase.ts                # Firebase initialization and database operations
│   ├── App.tsx                        # Main layout and state coordinator
│   ├── index.css                      # Global styles and Tailwind directives
│   └── main.tsx                       # React DOM entry point
```

### Next.js App Router Migration Blueprint
To prevent client-side cheating (such as inspecting network requests to find the daily song metadata), the project is designed to transition to a Next.js App Router structure. This allows song metadata to remain completely hidden on the server until the user submits their daily score.

```
songle-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── songs/
│   │   │   │   ├── daily/route.ts     # Resolves daily song (hides metadata until completed)
│   │   │   │   └── search/route.ts    # Proxies Spotify Autocomplete queries securely
│   │   │   └── cron/
│   │   │       └── daily-select/      # Automated server cron to select the daily song
│   │   ├── game/
│   │   │   └── page.tsx               # Primary gameplay route
│   │   └── leaderboard/
│   │       └── page.tsx               # Server-rendered global scoreboard
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Security Warnings

### 1. Firestore Security Rules
To prevent score tampering and unauthorized profile modifications, ensure your Firestore Security Rules are deployed exactly as defined in `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Public profiles; only the owner can write or delete their own
    match /users/{userId} {
      allow read: if true;
      allow create, update, delete: if isOwner(userId);
    }

    // Scores are immutable, one per user per day, bounded to the legit range
    match /scores/{scoreId} {
      allow read: if true;
      allow create: if isAuthenticated()
                    && request.resource.data.userId == request.auth.uid
                    && scoreId == request.auth.uid + "_" + request.resource.data.date
                    && request.resource.data.score is number
                    && request.resource.data.score >= 0
                    && request.resource.data.score <= 600;
      allow update, delete: if false;
    }
  }
}
```

### 2. API Key Protection
* **Never** commit your `firebase-applet-config.json` or `.env` files to public version control.
* Restrict your Firebase API keys in the Google Cloud Console to only allow requests from your authorized production domains.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Testing Suite & Benchmarks

The project includes unit and integration tests to validate core game mechanics, scoring algorithms, and database transactions.

### Running Tests
To run the test suite (configured via Vitest/Jest):
```sh
npm run test
```

### Key Test Suites
1. **Scoring Logic**: Verifies that base scores and speed bonuses are calculated correctly across all 6 attempt levels.
2. **Streak Calculations**: Validates that daily streaks increment correctly on consecutive days and reset to `0` if a day is skipped or lost.
3. **Offline Sync**: Simulates network disconnects to ensure that scores are saved to `localStorage` and successfully synced to Firestore once connection is re-established.

### Performance Benchmarks
* **Time to Interactive (TTI)**: < 1.2s on mobile devices.
* **Audio Latency**: < 200ms from play click to audio output (using pre-fetched iTunes streams).
* **Leaderboard Query Performance**: < 80ms for retrieving the Top 50 global scores using optimized composite indexes.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [x] Core Heardle-like gameplay loop with iTunes audio integration
- [x] Multi-provider social authentication (Google, GitHub, Twitter/X)
- [x] Guest session support with seamless account upgrading
- [x] Real-time global leaderboard with Firestore persistent caching
- [ ] Migrate to Next.js App Router for enhanced security and SEO
- [ ] Implement custom multiplayer lobbies for real-time group play
- [ ] Add support for custom user-created daily playlists

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contribution Guidelines

To maintain code quality and consistency:
* **TypeScript**: Ensure all new components and utilities are fully typed. Run `npm run lint` to verify there are no compiler errors.
* **Styling**: Use Tailwind CSS utility classes. Avoid writing custom CSS rules in `index.css` unless absolutely necessary.
* **Commits**: Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification (e.g., `feat: add share button`, `fix: resolve audio loop bug`).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

Tyroon - [@notyroon][twitter-url]

Project Link: [https://github.com/iamtyroon/songle](https://github.com/iamtyroon/songle)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Acknowledgments

* [iTunes Search API](https://performance-partners.apple.com/search-api) for seamless audio preview streaming.
* [Spotify Web API](https://developer.spotify.com/documentation/web-api) for rich track metadata and album artwork.
* [Dicebear Avatars](https://www.dicebear.com/) for beautiful, procedurally generated user avatars.
* [Lucide React](https://lucide.dev/) for clean, consistent iconography.
* [Motion](https://motion.dev/) for fluid, hardware-accelerated UI animations.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

[contributors-shield]: https://img.shields.io/github/contributors/iamtyroon/songle.svg?style=for-the-badge
[contributors-url]: https://github.com/iamtyroon/songle/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/iamtyroon/songle.svg?style=for-the-badge
[forks-url]: https://github.com/iamtyroon/songle/network/members
[stars-shield]: https://img.shields.io/github/stars/iamtyroon/songle.svg?style=for-the-badge
[stars-url]: https://github.com/iamtyroon/songle/stargazers
[issues-shield]: https://img.shields.io/github/issues/iamtyroon/songle.svg?style=for-the-badge
[issues-url]: https://github.com/iamtyroon/songle/issues
[license-shield]: https://img.shields.io/github/license/iamtyroon/songle.svg?style=for-the-badge
[license-url]: https://github.com/iamtyroon/songle/blob/main/LICENSE
[twitter-shield]: https://img.shields.io/badge/-Twitter-black.svg?style=for-the-badge&logo=x&colorB=555
[twitter-url]: https://x.com/notyroon

[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Vite.dev]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=FFD62E
[Vite-url]: https://vite.dev/
[TailwindCSS.com]: https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[Firebase.google.com]: https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black
[Firebase-url]: https://firebase.google.com/
[TypeScriptlang.org]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/

[product-screenshot]: public/screenshot.png
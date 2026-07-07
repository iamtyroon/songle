export interface TreeItem {
  name: string;
  type: "file" | "directory";
  description: string;
  children?: TreeItem[];
}

export const NEXT_JS_PROJECT_STRUCTURE: TreeItem = {
  name: "songle-app",
  type: "directory",
  description: "The root directory of the Next.js App Router project for Songle.",
  children: [
    {
      name: ".env.local",
      type: "file",
      description: "Local environment variables for development (Firebase credentials, Spotify Client Secret, Supabase config, Vercel variables)."
    },
    {
      name: "package.json",
      type: "file",
      description: "Project dependencies and scripts. Key dependencies: next, react, firebase, @supabase/supabase-js, lucide-react, motion."
    },
    {
      name: "tailwind.config.ts",
      type: "file",
      description: "Tailwind CSS configuration setting up custom font families (Inter, Space Grotesk) and default dark mode rules ('class')."
    },
    {
      name: "tsconfig.json",
      type: "file",
      description: "TypeScript compiler settings, configuring path aliases like '@/components/*' and '@/lib/*'."
    },
    {
      name: "src",
      type: "directory",
      description: "Main application source folder containing routing, client components, style sheets, and shared backend helper utilities.",
      children: [
        {
          name: "app",
          type: "directory",
          description: "Next.js App Router core routing directory. All subfolders represent visual screens or backend API endpoints.",
          children: [
            {
              name: "layout.tsx",
              type: "file",
              description: "Root layout hosting global CSS, ThemeProvider, Google Analytics, metadata, and body tag wrappers."
            },
            {
              name: "page.tsx",
              type: "file",
              description: "The main home page. Greets players, explains rules, and prompts them to play the daily challenge or sign in."
            },
            {
              name: "auth",
              type: "directory",
              description: "Authentication screens and redirect flows for OAuth integration.",
              children: [
                {
                  name: "login",
                  type: "directory",
                  description: "Login portal directory.",
                  children: [
                    {
                      name: "page.tsx",
                      type: "file",
                      description: "Renders OAuth sign-in options, centering the high-conversion 'Sign in with Spotify' button."
                    }
                  ]
                },
                {
                  name: "callback",
                  type: "directory",
                  description: "Auth callback redirect handler.",
                  children: [
                    {
                      name: "route.ts",
                      type: "file",
                      description: "App Router API handler for processing code tokens from Supabase Auth / Spotify and establishing user sessions."
                    }
                  ]
                }
              ]
            },
            {
              name: "game",
              type: "directory",
              description: "Core gameplay routes and game logic engines.",
              children: [
                {
                  name: "page.tsx",
                  type: "file",
                  description: "The primary daily game workspace. Sells gameplay state, queries daily song, and handles wrong/right answers."
                },
                {
                  name: "history",
                  type: "directory",
                  description: "User historical logs of prior plays.",
                  children: [
                    {
                      name: "page.tsx",
                      type: "file",
                      description: "Secured view of historical daily song scores, correct track records, and completed ratios."
                    }
                  ]
                }
              ]
            },
            {
              name: "leaderboard",
              type: "directory",
              description: "Competitive scoreboard routes.",
              children: [
                {
                  name: "page.tsx",
                  type: "file",
                  description: "Fetches and renders the Top 50 global scores for the day, along with personal rank calculations."
                }
              ]
            },
            {
              name: "api",
              type: "directory",
              description: "Server-side REST API routes to proxy external requests, hiding secrets from client bundle.",
              children: [
                {
                  name: "songs",
                  type: "directory",
                  description: "Songs helper endpoint directory.",
                  children: [
                    {
                      name: "search",
                      type: "directory",
                      description: "Autocomplete query handler.",
                      children: [
                        {
                          name: "route.ts",
                          type: "file",
                          description: "Queries the Spotify Web API with autocomplete suggestions. Proxies the request using a server-side client-credentials token."
                        }
                      ]
                    },
                    {
                      name: "daily",
                      type: "directory",
                      description: "Curation and resolver endpoint.",
                      children: [
                        {
                          name: "route.ts",
                          type: "file",
                          description: "Returns the curated song of the day. Restricts returns to exclude answer details until user completes game."
                        }
                      ]
                    }
                  ]
                },
                {
                  name: "cron",
                  type: "directory",
                  description: "Background scheduler endpoints.",
                  children: [
                    {
                      name: "daily-select",
                      type: "directory",
                      description: "Cron action handler.",
                      children: [
                        {
                          name: "route.ts",
                          type: "file",
                          description: "A secure server cron job running at 00:00 UTC to auto-select and write a new song to firestore 'daily_songs'."
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          name: "components",
          type: "directory",
          description: "Shared React client components styled with Tailwind CSS utility declarations.",
          children: [
            {
              name: "game-loop.tsx",
              type: "file",
              description: "The container rendering play progress segments, managing attempt states, and controlling player interactions."
            },
            {
              name: "audio-player.tsx",
              type: "file",
              description: "Highly customized audio visualizer and controller wrapper. Caps audio playback strictly based on the current attempt seconds (1s, 2s, 4s, etc.)."
            },
            {
              name: "song-search-bar.tsx",
              type: "file",
              description: "Typeahead input matching Spotify API entities to format and constrain player answers."
            },
            {
              name: "share-modal.tsx",
              type: "file",
              description: "The end-of-game modal displaying streak summaries, speed bonus metrics, and generating emoji layouts (🟩⬜⬜⬜⬜⬜)."
            },
            {
              name: "leaderboard-table.tsx",
              type: "file",
              description: "A lightweight, beautiful high-contrast ranking scoreboard with search and avatar renders."
            },
            {
              name: "navbar.tsx",
              type: "file",
              description: "A clean header hosting title typography, auth session buttons, game stat modals, and leaderboard redirects."
            }
          ]
        },
        {
          name: "lib",
          type: "directory",
          description: "Backend helpers, client libraries, database singletons, and integration wrappers.",
          children: [
            {
              name: "firebase.ts",
              type: "file",
              description: "Initializes and exports Firestore database instances and Auth client configurations."
            },
            {
              name: "spotify.ts",
              type: "file",
              description: "Handles Spotify Web API server auth token acquisition (Client Credentials grant) and structures metadata querying."
            },
            {
              name: "supabase.ts",
              type: "file",
              description: "Initializes Supabase Client used strictly for OAuth logins, securing user accounts via Spotify sign-in."
            },
            {
              name: "utils.ts",
              type: "file",
              description: "Small helper functions including time formatters, clipboard copy actions, and score calculations."
            }
          ]
        },
        {
          name: "types.ts",
          type: "file",
          description: "Shared TypeScript interface definitions mapping Firestore models, game states, and API responses."
        },
        {
          name: "global.css",
          type: "file",
          description: "Main css file declaring @import 'tailwindcss' along with core custom animations like visual shakes."
        }
      ]
    }
  ]
};

export const NEXT_JS_ROUTING_INFO = `### Next.js App Router Structure Details

Next.js App Router relies on **file-system based routing**:
- Directories define route paths.
- \`page.tsx\` files make those routes publicly accessible.
- \`route.ts\` files inside an \`api/\` subfolder represent REST API endpoints (server-side).

For a secure daily music game, this full-stack setup is critical to prevent cheating:
1. **Hidden Song Answers**: The user cannot inspect their browser network requests to see the daily song title/artist. The \`/api/songs/daily\` endpoint only returns the encrypted song ID or just the iTunes \`preview_url\` without revealing metadata. The metadata is only returned once the user records a \`user_scores\` record on Firebase!
2. **Spotify Token Security**: Spotify requires a \`Client Secret\` to perform metadata lookups and autocomplete searches. Performing this on the client would leak the key. The Next.js \`/api/songs/search\` server-side route acts as a proxy, safely maintaining credentials in server environments.
`;

export const INTEGRATION_GUIDE = `### Spotify & iTunes Integration Blueprint

#### 1. iTunes Search API (Audio previews)
The iTunes Search API does not require an API key or registration. It returns direct m4a files that can be rendered using standard web HTML5 Audio objects.

**Sample iTunes Fetch URL**:
\`\`\`bash
https://itunes.apple.com/search?term=The+Weeknd+Blinding+Lights&limit=1&entity=song
\`\`\`

#### 2. Spotify API Integration (Metadata, Album Art & Play Links)
Spotify API requires standard OAuth 2.0. In a Next.js environment, the server retrieves a \`client_credentials\` token and caches it.

**Server-Side Token Acquisition**:
\`\`\`typescript
export async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
    },
    body: "grant_type=client_credentials",
    next: { revalidate: 3500 } // Token expires in 1 hour (3600s)
  });

  const data = await response.json();
  return data.access_token;
}
\`\`\`

**Searching Spotify (Server-Side Proxy Autocomplete)**:
\`\`\`typescript
export async function searchSpotifyTracks(query: string) {
  const token = await getSpotifyAccessToken();
  const response = await fetch(\`https://api.spotify.com/v1/search?q=\${encodeURIComponent(query)}&type=track&limit=6\`, {
    headers: {
      Authorization: \`Bearer \${token}\`
    }
  });
  
  const data = await response.json();
  return data.tracks.items.map((track: any) => ({
    spotify_id: track.id,
    title: track.name,
    artist: track.artists[0].name,
    album_name: track.album.name,
    artwork_url: track.album.images[0]?.url,
    spotify_url: track.external_urls.spotify
  }));
}
\`\`\`
`;

export interface FirestoreField {
  name: string;
  type: string;
  description: string;
  example: string | number | boolean;
}

export interface FirestoreCollection {
  name: string;
  description: string;
  documentIdFormat: string;
  fields: FirestoreField[];
}

export const FIRESTORE_SCHEMA: FirestoreCollection[] = [
  {
    name: "daily_songs",
    description: "Stores the selected song for each day, identified by the date string (YYYY-MM-DD). This ensures all users query the exact same document for a given date.",
    documentIdFormat: "YYYY-MM-DD (e.g., '2026-07-06')",
    fields: [
      {
        name: "date",
        type: "string",
        description: "The unique calendar date representation (Key-aligned for quick reads)",
        example: "2026-07-06"
      },
      {
        name: "spotify_id",
        type: "string",
        description: "The official Spotify Track ID, useful for generating 'Play on Spotify' links and high-quality album art via the Spotify Web API.",
        example: "0VjIjW4GlUZAMY0vGZfI7n"
      },
      {
        name: "preview_url",
        type: "string",
        description: "The 30-second audio clip preview URL, typically sourced dynamically from the iTunes Search API.",
        example: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/37/87/..."
      },
      {
        name: "song_title",
        type: "string",
        description: "The title of the song used for the trivia answer and verification.",
        example: "Blinding Lights"
      },
      {
        name: "artist_name",
        type: "string",
        description: "The principal artist or bands responsible for the track.",
        example: "The Weeknd"
      },
      {
        name: "album_name",
        type: "string",
        description: "The title of the album the track belongs to.",
        example: "After Hours"
      },
      {
        name: "artwork_url",
        type: "string",
        description: "Direct URL to the high-resolution album cover artwork.",
        example: "https://is1-ssl.mzstatic.com/image/thumb/Music115/..."
      },
      {
        name: "created_at",
        type: "timestamp",
        description: "Server timestamp of when the song was curated/inserted into the schedule.",
        example: "Timestamp(seconds=1783353600, nanoseconds=0)"
      }
    ]
  },
  {
    name: "user_scores",
    description: "Tracks individual user game scores and attempts for a specific day. This is querying-optimized with composite indexes for global and friend leaderboards.",
    documentIdFormat: "{user_id}_{date} (e.g., 'usr_abc123_2026-07-06' to enforce exactly one entry per user per day)",
    fields: [
      {
        name: "user_id",
        type: "string",
        description: "The unique Firebase Authentication UID of the player.",
        example: "p8YvN2sUjGf0X9aKz1W4rP7sE3"
      },
      {
        name: "username",
        type: "string",
        description: "Display name of the user, cached on the score record for fast, single-query leaderboard rendering without join lookups.",
        example: "AeroBeats"
      },
      {
        name: "photo_url",
        type: "string",
        description: "Cached user avatar image URL for rendering in leaderboards.",
        example: "https://lh3.googleusercontent.com/a/AATXAJ..."
      },
      {
        name: "score",
        type: "number",
        description: "Calculated based on PRD formula: (6 - attempts_used) * 100 + speed_bonus. Ranges up to 600 points + dynamic speed additions.",
        example: 542
      },
      {
        name: "attempts",
        type: "number",
        description: "The number of snippets unlocked (1 to 6) when the guess succeeded or the game was finished.",
        example: 2
      },
      {
        name: "completed",
        type: "boolean",
        description: "True if the user finished the game loop (either by guessing correctly or failing all 6 attempts).",
        example: true
      },
      {
        name: "guessed_correctly",
        type: "boolean",
        description: "True if the user successfully identified the song, false if they exhausted all 6 attempts without success.",
        example: true
      },
      {
        name: "date",
        type: "string",
        description: "The calendar date associated with this score (YYYY-MM-DD), matching the daily_songs key.",
        example: "2026-07-06"
      },
      {
        name: "completed_at",
        type: "timestamp",
        description: "Server timestamp when the score was recorded.",
        example: "Timestamp(seconds=1783359123, nanoseconds=500000)"
      }
    ]
  },
  {
    name: "user_stats",
    description: "Aggregates overall lifetime statistics, streaks, and historical records for each user. Updated atomically using Firestore transactions when user_scores documents are written.",
    documentIdFormat: "{user_id} (e.g., 'usr_abc123' mapping directly to their Auth Profile)",
    fields: [
      {
        name: "user_id",
        type: "string",
        description: "Firebase Auth unique UID.",
        example: "p8YvN2sUjGf0X9aKz1W4rP7sE3"
      },
      {
        name: "total_played",
        type: "number",
        description: "The total number of daily challenges started by the user.",
        example: 42
      },
      {
        name: "total_wins",
        type: "number",
        description: "The number of daily challenges completed successfully.",
        example: 38
      },
      {
        name: "current_streak",
        type: "number",
        description: "Continuous daily streak. Increments if the user wins on consecutive days, resets to 0 if a day is skipped or lost.",
        example: 12
      },
      {
        name: "max_streak",
        type: "number",
        description: "The longest consecutive daily win streak achieved by this player.",
        example: 25
      },
      {
        name: "guess_distribution",
        type: "map (array of numbers)",
        description: "Keys '1' through '6' representing how many times a player won on each attempt level.",
        example: "{ '1': 4, '2': 14, '3': 10, '4': 5, '5': 3, '6': 2 }"
      },
      {
        name: "last_played_date",
        type: "string",
        description: "The date of the last recorded score, used to calculate streak eligibility.",
        example: "2026-07-05"
      },
      {
        name: "updated_at",
        type: "timestamp",
        description: "Last state update timestamp.",
        example: "Timestamp(seconds=1783359124, nanoseconds=0)"
      }
    ]
  }
];

export const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper checks
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // 1. daily_songs collection
    // Accessible to all users for reading. Only writable by administrative backend/dashboard.
    match /daily_songs/{date} {
      allow read: if true;
      allow write: if false; // Block client writes - managed via server-side admin or Cloud Functions
    }

    // 2. user_scores collection
    // Users can read any score (for the global leaderboard) but can only write their own score.
    // Document ID format: "{user_id}_{date}"
    match /user_scores/{scoreId} {
      allow read: if true; // Publicly readable to construct daily leaderboards
      
      allow create: if isAuthenticated() 
                    && request.resource.data.user_id == request.auth.uid
                    && scoreId == request.auth.uid + "_" + request.resource.data.date;
                    
      allow update: if false; // Make scores immutable after submission to prevent tampering
      allow delete: if false; // Leaderboard history cannot be deleted by users
    }

    // 3. user_stats collection
    // Users can read anyone's stats (for profiles), but can only write their own stats.
    match /user_stats/{userId} {
      allow read: if true;
      allow write: if isOwner(userId);
    }
  }
}`;

export const FIRESTORE_INDEXES = `{
  "indexes": [
    {
      "collectionGroup": "user_scores",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "score", "order": "DESCENDING" },
        { "fieldPath": "completed_at", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}`;

export const FIREBASE_NEXTJS_CODE_SNIPPET = `// src/lib/firebase.ts (Next.js config)
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
`;

export const FIREBASE_FETCH_EXAMPLE = `// src/app/game/actions.ts
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, increment, runTransaction } from "firebase/firestore";

// Fetch the song of the day
export async function getDailySong(dateStr: string) {
  const songDocRef = doc(db, "daily_songs", dateStr);
  const songSnapshot = await getDoc(songDocRef);
  
  if (!songSnapshot.exists()) {
    throw new Error("No Songle of the Day is curated for today!");
  }
  
  return songSnapshot.data();
}

// Save user score and update lifetime statistics atomically using a transaction
export async function submitUserScore(userId: string, username: string, gameStats: {
  date: string;
  score: number;
  attempts: number;
  guessedCorrectly: boolean;
}) {
  const scoreDocId = \`\${userId}_\${gameStats.date}\`;
  const scoreRef = doc(db, "user_scores", scoreDocId);
  const statsRef = doc(db, "user_stats", userId);
  
  await runTransaction(db, async (transaction) => {
    // 1. Check if user already submitted a score for today
    const scoreSnap = await transaction.get(scoreRef);
    if (scoreSnap.exists()) {
      throw new Error("You have already recorded your Songle score for today!");
    }
    
    // 2. Write the daily score
    transaction.set(scoreRef, {
      user_id: userId,
      username,
      score: gameStats.score,
      attempts: gameStats.attempts,
      date: gameStats.date,
      guessed_correctly: gameStats.guessedCorrectly,
      completed: true,
      completed_at: new Date(),
    });
    
    // 3. Update cumulative statistics
    const statsSnap = await transaction.get(statsRef);
    if (!statsSnap.exists()) {
      // Initialize stats document
      const distribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 };
      if (gameStats.guessedCorrectly) {
        distribution[String(gameStats.attempts) as keyof typeof distribution] = 1;
      }
      
      transaction.set(statsRef, {
        user_id: userId,
        total_played: 1,
        total_wins: gameStats.guessedCorrectly ? 1 : 0,
        current_streak: gameStats.guessedCorrectly ? 1 : 0,
        max_streak: gameStats.guessedCorrectly ? 1 : 0,
        guess_distribution: distribution,
        last_played_date: gameStats.date,
        updated_at: new Date()
      });
    } else {
      const stats = statsSnap.data();
      const prevPlayedDate = stats.last_played_date;
      
      // Calculate daily streaks
      let newStreak = stats.current_streak;
      if (gameStats.guessedCorrectly) {
        if (isYesterday(prevPlayedDate, gameStats.date)) {
          newStreak += 1;
        } else if (prevPlayedDate === gameStats.date) {
          // Already played today, streak remains same
        } else {
          // Streak broken
          newStreak = 1;
        }
      } else {
        newStreak = 0; // Lost breaks streak
      }
      
      const newMaxStreak = Math.max(stats.max_streak, newStreak);
      const updatedDistribution = { ...stats.guess_distribution };
      if (gameStats.guessedCorrectly) {
        const key = String(gameStats.attempts);
        updatedDistribution[key] = (updatedDistribution[key] || 0) + 1;
      }
      
      transaction.update(statsRef, {
        total_played: increment(1),
        total_wins: gameStats.guessedCorrectly ? increment(1) : stats.total_wins,
        current_streak: newStreak,
        max_streak: newMaxStreak,
        guess_distribution: updatedDistribution,
        last_played_date: gameStats.date,
        updated_at: new Date()
      });
    }
  });
}

function isYesterday(prevDateStr: string, currentDateStr: string): boolean {
  const prev = new Date(prevDateStr);
  const current = new Date(currentDateStr);
  const diffTime = Math.abs(current.getTime() - prev.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}
`;

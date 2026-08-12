import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  TwitterAuthProvider, 
  GithubAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInAnonymously,
  signOut,
  User as FirebaseUser,
  EmailAuthProvider,
  updatePassword,
  updateEmail,
  deleteUser,
  reauthenticateWithCredential
} from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  getDocs, 
  query, 
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { advanceStreak, dayKey, effectiveStreak } from "./streak";

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Initialize Firestore with local cache for robust offline support
let db: any;
const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;

try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, databaseId);
} catch (e) {
  console.warn("Could not initialize Firestore with persistent local cache, falling back to standard initialization", e);
  db = getFirestore(app, databaseId);
}

// Authentication Providers
const googleProvider = new GoogleAuthProvider();
const twitterProvider = new TwitterAuthProvider();
const githubProvider = new GithubAuthProvider();

export { app, auth, db };

// Interface for User Stats in Firestore
export interface UserStats {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
  distribution: number[];
  points: number;
  /** Local day of the last finished game. Distinguishes a gap from a live run. */
  lastPlayedDate?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  providerId: string;
  createdAt: any;
  stats: UserStats;
}

const DEFAULT_STATS: UserStats = {
  played: 0,
  wins: 0,
  streak: 0,
  maxStreak: 0,
  distribution: [0, 0, 0, 0, 0, 0],
  points: 0
};

/**
 * Syncs user data and stats to Firestore on successful login or registration
 */
export async function syncUserProfile(user: FirebaseUser, customDisplayName?: string): Promise<UserProfile> {
  const userRef = doc(db, "users", user.uid);
  
  let userSnap;
  let isOffline = false;

  try {
    userSnap = await getDoc(userRef);
  } catch (error: any) {
    console.error("Error fetching user profile from Firestore, attempting offline fallback:", error);
    isOffline = true;
  }

  let displayName = customDisplayName || user.displayName || `Songler_${user.uid.substring(0, 5)}`;
  // Fallback photoURL or generic avatar based on username
  let photoURL = user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(displayName)}`;

  if (!isOffline && userSnap && userSnap.exists()) {
    const data = userSnap.data();

    // Update basic user profile info in case they updated displayName/photoURL, but preserve stats
    const updatedProfile = {
      uid: user.uid,
      displayName: data.displayName || displayName,
      email: user.email,
      photoURL: data.photoURL || photoURL,
      providerId: user.providerData[0]?.providerId || "anonymous",
      stats: data.stats || DEFAULT_STATS
    };
    try {
      await updateDoc(userRef, {
        displayName: updatedProfile.displayName,
        photoURL: updatedProfile.photoURL,
        email: updatedProfile.email
      });
    } catch (e) {
      console.warn("Failed to update user profile in Firestore (possibly offline)", e);
    }
    return {
      ...updatedProfile,
      createdAt: data.createdAt
    } as UserProfile;
  } else {
    // Check if there are local stats we can migrate
    let localStats = DEFAULT_STATS;
    const savedStats = localStorage.getItem("songle_stats");
    if (savedStats) {
      try {
        const parsed = JSON.parse(savedStats);
        // Calculate points based on historical wins if points are not defined
        const calculatedPoints = parsed.points || (parsed.wins * 350); // Fallback: 350 pts per win
        localStats = {
          played: parsed.played || 0,
          wins: parsed.wins || 0,
          streak: parsed.streak || 0,
          maxStreak: parsed.maxStreak || 0,
          distribution: parsed.distribution || [0, 0, 0, 0, 0, 0],
          points: calculatedPoints,
          lastPlayedDate: parsed.lastPlayedDate
        };
      } catch (e) {
        console.error("Failed to parse local stats for migration", e);
      }
    }

    const newProfile: UserProfile = {
      uid: user.uid,
      displayName,
      email: user.email,
      photoURL,
      providerId: user.providerData[0]?.providerId || "anonymous",
      createdAt: isOffline ? null : serverTimestamp(),
      stats: localStats
    };

    if (!isOffline) {
      try {
        await setDoc(userRef, {
          ...newProfile,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("Failed to write new user profile to Firestore (possibly offline)", e);
      }
    }

    return newProfile;
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return await syncUserProfile(result.user);
  } catch (error: any) {
    console.error("Google Auth Error", error);
    if (error.code === "auth/popup-blocked" || error.code === "auth/operation-not-allowed") {
      // Fallback to redirect inside iframe
      await signInWithRedirect(auth, googleProvider);
    }
    throw error;
  }
}

/**
 * Sign in with Twitter/X
 */
export async function signInWithTwitter() {
  try {
    const result = await signInWithPopup(auth, twitterProvider);
    return await syncUserProfile(result.user);
  } catch (error: any) {
    console.error("Twitter Auth Error", error);
    if (error.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, twitterProvider);
    }
    throw error;
  }
}

/**
 * Sign in with Github
 */
export async function signInWithGithub() {
  try {
    const result = await signInWithPopup(auth, githubProvider);
    return await syncUserProfile(result.user);
  } catch (error: any) {
    console.error("Github Auth Error", error);
    if (error.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, githubProvider);
    }
    throw error;
  }
}

/**
 * Sign in or Register Anonymously
 */
export async function signInGuest() {
  const result = await signInAnonymously(auth);
  return await syncUserProfile(result.user);
}

/**
 * Register with Email and Password
 */
export async function registerWithEmail(email: string, pass: string, name: string) {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(result.user, { displayName: name });
  return await syncUserProfile(result.user, name);
}

/**
 * Login with Email and Password
 */
export async function loginWithEmail(email: string, pass: string) {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return await syncUserProfile(result.user);
}

/**
 * Logout
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Update user profile details
 */
export async function updateUserProfile(displayName: string, photoURL: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("No user is logged in");

  await updateProfile(currentUser, { displayName, photoURL });
  
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    displayName,
    photoURL
  });
}

/**
 * Submit daily score to Firestore
 */
export async function submitUserScore(
  score: number, 
  attempts: number, 
  hasWon: boolean, 
  guesses: any[],
  songTitle: string,
  songArtist: string
) {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const userRef = doc(db, "users", currentUser.uid);
  let userSnap;
  let isOffline = false;

  try {
    userSnap = await getDoc(userRef);
  } catch (error: any) {
    console.error("Error fetching user profile for score submission, updating locally:", error);
    isOffline = true;
  }

  // Fallback / current stats
  let currentStats = DEFAULT_STATS;
  let displayName = `Songler_${currentUser.uid.substring(0, 5)}`;
  let photoURL = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(displayName)}`;

  if (!isOffline && userSnap && userSnap.exists()) {
    const userData = userSnap.data() as UserProfile;
    currentStats = userData.stats || DEFAULT_STATS;
    displayName = userData.displayName || displayName;
    photoURL = userData.photoURL || photoURL;
  } else {
    // Read stats from localStorage if offline
    const savedStats = localStorage.getItem("songle_stats");
    if (savedStats) {
      try {
        currentStats = JSON.parse(savedStats);
      } catch (e) {
        console.error("Error reading stats from localStorage during offline score submission", e);
      }
    }
  }

  // Compute new stats
  const nextPlayed = (currentStats.played || 0) + 1;
  const nextWins = hasWon ? (currentStats.wins || 0) + 1 : (currentStats.wins || 0);
  const nextStreak = advanceStreak(
    currentStats.streak || 0,
    currentStats.lastPlayedDate,
    hasWon
  );
  const nextMaxStreak = Math.max(currentStats.maxStreak || 0, nextStreak);
  const nextDistribution = [...(currentStats.distribution || [0, 0, 0, 0, 0, 0])];
  if (hasWon && attempts >= 1 && attempts <= 6) {
    nextDistribution[attempts - 1] += 1;
  }
  
  // Calculate allocated points
  const pointsAllocated = score;
  const nextPoints = (currentStats.points || 0) + pointsAllocated;

  const updatedStats: UserStats = {
    played: nextPlayed,
    wins: nextWins,
    streak: nextStreak,
    maxStreak: nextMaxStreak,
    distribution: nextDistribution,
    points: nextPoints,
    lastPlayedDate: dayKey()
  };

  // Sync to local storage for local stats integrity
  localStorage.setItem("songle_stats", JSON.stringify(updatedStats));

  if (!isOffline) {
    try {
      // 1. Update overall User document
      await updateDoc(userRef, {
        stats: updatedStats
      });

      // 2. Record daily score in scores collection
      const dateStr = new Date().toISOString().split("T")[0];
      const scoreRef = doc(db, "scores", `${currentUser.uid}_${dateStr}`);
      await setDoc(scoreRef, {
        userId: currentUser.uid,
        displayName,
        photoURL,
        date: dateStr,
        score: score,
        attempts: attempts,
        hasWon: hasWon,
        guesses: guesses,
        songTitle,
        songArtist,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to submit score to Firestore (possibly offline)", e);
    }
  }
}

/**
 * Get Leaderboard from Firestore
 */
export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  points: number;
  wins: number;
  played: number;
  streak: number;
}

export async function fetchLeaderboard(limitCount = 10): Promise<LeaderboardEntry[]> {
  try {
    const q = query(
      collection(db, "users"),
      orderBy("stats.points", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const entries: LeaderboardEntry[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data && data.stats) {
        entries.push({
          uid: doc.id,
          displayName: data.displayName || "Unknown player",
          photoURL: data.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(doc.id)}`,
          points: data.stats.points || 0,
          wins: data.stats.wins || 0,
          played: data.stats.played || 0,
          // Another player's stored streak is stale until they next play, so
          // decay it here rather than showing a dead run as live.
          streak: effectiveStreak(data.stats.streak, data.stats.lastPlayedDate)
        });
      }
    });
    return entries;
  } catch (error) {
    console.error("Error fetching leaderboard", error);
    return [];
  }
}

/**
 * Update email address of the current user
 */
export async function updateUserEmail(newEmail: string, currentPassword?: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("No user is logged in");

  // Reauthenticate if password is provided
  if (currentPassword && currentUser.email) {
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
  }

  await updateEmail(currentUser, newEmail);
  
  // Sync to Firestore
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    email: newEmail
  });
}

/**
 * Update password of the current user
 */
export async function updateUserPassword(newPassword: string, currentPassword?: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("No user is logged in");

  // Reauthenticate if password is provided
  if (currentPassword && currentUser.email) {
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
  }

  await updatePassword(currentUser, newPassword);
}

/**
 * Delete the current user's account and data
 */
export async function deleteUserAccount(currentPassword?: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("No user is logged in");

  // Reauthenticate if password is provided
  if (currentPassword && currentUser.email) {
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
  }

  // Delete Firestore user document
  const userRef = doc(db, "users", currentUser.uid);
  try {
    await deleteDoc(userRef);
  } catch (error) {
    console.error("Error deleting Firestore user document during account deletion", error);
  }

  // Delete actual Firebase user
  await deleteUser(currentUser);
}

/**
 * Fetch current user's score for today
 */
export async function fetchUserTodayScore(): Promise<any | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  const dateStr = new Date().toISOString().split("T")[0];
  const scoreRef = doc(db, "scores", `${currentUser.uid}_${dateStr}`);
  try {
    const snap = await getDoc(scoreRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.error("Error fetching today's user score from Firestore:", e);
  }
  return null;
}


import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "./firebase";
import type { Song } from "../data/songs";

export interface RoomResult {
  songId: string;
  score: number;
  attempts: number;
  hasWon: boolean;
}

export interface Room {
  code: string;
  name: string;
  hostUid: string;
  songs: Song[];
}

export interface RoomPlayer {
  uid: string;
  displayName: string;
  photoURL: string;
  totalScore: number;
  results: RoomResult[];
}

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1

export function makeRoomCode(): string {
  return Array.from({ length: 5 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

/** Host creates a room. Retries on code collision. */
export async function createRoom(name: string, songs: Song[]): Promise<Room> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to host a room");
  if (songs.length < 1) throw new Error("Pick at least one song");

  for (let i = 0; i < 5; i++) {
    const code = makeRoomCode();
    const ref = doc(db, "rooms", code);
    if ((await getDoc(ref)).exists()) continue;
    const room: Room = { code, name: name.trim() || "Untitled room", hostUid: user.uid, songs };
    await setDoc(ref, { ...room, createdAt: serverTimestamp() });
    return room;
  }
  throw new Error("Could not allocate a room code, try again");
}

export async function fetchRoom(code: string): Promise<Room | null> {
  const snap = await getDoc(doc(db, "rooms", code.toUpperCase().trim()));
  return snap.exists() ? (snap.data() as Room) : null;
}

/** Join (or re-join) a room. Idempotent: existing progress is preserved. */
export async function joinRoom(
  code: string,
  displayName: string,
  photoURL: string
): Promise<RoomPlayer> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to join a room");
  const room = await fetchRoom(code);
  if (!room) throw new Error("No room with that code");

  const ref = doc(db, "rooms", room.code, "players", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as RoomPlayer;

  const player: RoomPlayer = { uid: user.uid, displayName, photoURL, totalScore: 0, results: [] };
  await setDoc(ref, player);
  return player;
}

/**
 * Record one song's result. Rewrites the whole player doc so the
 * client-computed total stays consistent with the results list.
 * Re-playing a song replaces its earlier result rather than stacking.
 */
export async function submitRoomResult(
  code: string,
  result: RoomResult
): Promise<RoomPlayer> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to play");
  const ref = doc(db, "rooms", code, "players", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Join the room first");

  const prev = snap.data() as RoomPlayer;
  const results = [...prev.results.filter((r) => r.songId !== result.songId), result];
  const next: RoomPlayer = {
    ...prev,
    results,
    totalScore: results.reduce((sum, r) => sum + r.score, 0)
  };
  await setDoc(ref, next);
  return next;
}

/** Live room leaderboard. Returns the unsubscribe function. */
export function subscribeRoomLeaderboard(
  code: string,
  onChange: (players: RoomPlayer[]) => void
): () => void {
  const q = query(collection(db, "rooms", code, "players"), orderBy("totalScore", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as RoomPlayer)),
    (err) => console.error("Room leaderboard subscription error", err)
  );
}

import React, { useState, useEffect } from "react";
import { Search, Music, X, Users, Copy, Check, Plus, LogIn, Trophy } from "lucide-react";
import { Song, searchiTunesSongs } from "../data/songs";
import { UserProfile } from "../lib/firebase";
import {
  Room,
  RoomPlayer,
  RoomResult,
  createRoom,
  fetchRoom,
  joinRoom,
  submitRoomResult,
  subscribeRoomLeaderboard
} from "../lib/rooms";
import SongleGame from "./SongleGame";

interface RoomViewProps {
  userProfile: UserProfile | null;
  onOpenAuth: () => void;
  onExit: () => void;
  showHowToPlay?: boolean;
  onOpenHowToPlay?: () => void;
  onCloseHowToPlay?: () => void;
  /** Code from ?room=CODE, prefills the join field. */
  initialCode?: string;
}

const card = "bg-bento-card border border-bento-border rounded-3xl p-6 shadow-xl";
const input =
  "w-full bg-bento-bg border border-bento-border rounded-2xl px-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-spotify focus:ring-2 focus:ring-spotify/15 transition-all";
const primaryBtn =
  "bg-spotify text-black hover:bg-spotify-hover px-5 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-display flex items-center justify-center gap-2";

export default function RoomView({
  userProfile,
  onOpenAuth,
  onExit,
  showHowToPlay,
  onOpenHowToPlay,
  onCloseHowToPlay,
  initialCode
}: RoomViewProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [songIndex, setSongIndex] = useState(0);
  const [error, setError] = useState("");

  // Live room board. Also feeds "songs you already played" on re-join.
  useEffect(() => {
    if (!room) return;
    return subscribeRoomLeaderboard(room.code, setPlayers);
  }, [room?.code]);

  const me = players.find((p) => p.uid === userProfile?.uid);

  const handleResult = async (result: RoomResult) => {
    if (!room) return;
    try {
      await submitRoomResult(room.code, result);
    } catch (e: any) {
      setError(e?.message || "Could not save that score");
    }
  };

  if (!userProfile) {
    return (
      <div className={`${card} max-w-md mx-auto text-center`}>
        <Users className="w-8 h-8 text-spotify mx-auto mb-3" />
        <h3 className="text-lg font-bold font-display text-white">Rooms need an account</h3>
        <p className="text-xs text-zinc-400 font-mono mt-2 mb-5">
          Sign in so your scores show up on the room board.
        </p>
        <button onClick={onOpenAuth} className={`${primaryBtn} w-full`}>
          Sign in
        </button>
      </div>
    );
  }

  if (room) {
    return (
      <>
        {error && (
          <p className="max-w-6xl mx-auto mb-4 text-xs font-mono text-rose-400 text-center">{error}</p>
        )}
        {/* No key remount needed: the game already resets itself when the target song changes. */}
        <SongleGame
          userProfile={userProfile}
          onOpenAuth={onOpenAuth}
          showHowToPlay={showHowToPlay}
          onOpenHowToPlay={onOpenHowToPlay}
          onCloseHowToPlay={onCloseHowToPlay}
          room={{
            name: `${room.name} · ${room.code}`,
            songs: room.songs,
            index: songIndex,
            players,
            onResult: handleResult,
            onNext: () => setSongIndex((i) => Math.min(i + 1, room.songs.length - 1)),
            onExit
          }}
        />
        {me && (
          <p className="max-w-6xl mx-auto mt-6 text-center text-xs font-mono text-zinc-500">
            Your room total: <span className="text-spotify font-bold">{me.totalScore}</span> pts across{" "}
            {me.results.length} song{me.results.length === 1 ? "" : "s"}
          </p>
        )}
      </>
    );
  }

  return (
    <RoomLobby
      userProfile={userProfile}
      initialCode={initialCode}
      onExit={onExit}
      onEnter={(r) => {
        setRoom(r);
        setSongIndex(0);
        setError("");
      }}
    />
  );
}

function RoomLobby({
  userProfile,
  initialCode,
  onEnter,
  onExit
}: {
  userProfile: UserProfile;
  initialCode?: string;
  onEnter: (room: Room) => void;
  onExit: () => void;
}) {
  const [tab, setTab] = useState<"join" | "host">(initialCode ? "join" : "join");
  const [code, setCode] = useState(initialCode || "");
  const [roomName, setRoomName] = useState("");
  const [picked, setPicked] = useState<Song[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setResults(query.trim().length >= 2 ? await searchiTunesSongs(query) : []);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const enter = async (roomCode: string) => {
    setBusy(true);
    setError("");
    try {
      await joinRoom(roomCode, userProfile.displayName, userProfile.photoURL || "");
      const r = await fetchRoom(roomCode);
      if (!r) throw new Error("No room with that code");
      onEnter(r);
    } catch (e: any) {
      setError(e?.message || "Could not join that room");
    } finally {
      setBusy(false);
    }
  };

  const handleHost = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await createRoom(roomName, picked);
      setCreatedCode(r.code);
      await joinRoom(r.code, userProfile.displayName, userProfile.photoURL || "");
    } catch (e: any) {
      setError(e?.message || "Could not create the room");
    } finally {
      setBusy(false);
    }
  };

  const shareLink = createdCode ? `${window.location.origin}/?room=${createdCode}` : "";

  return (
    <div className="w-full max-w-2xl mx-auto text-white space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Challenge rooms</h2>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            Host picks the songs. Everyone guesses. Room board only.
          </p>
        </div>
        <button
          onClick={onExit}
          className="text-xs font-mono text-zinc-500 hover:text-spotify cursor-pointer bg-transparent border-none transition-colors"
        >
          Back to daily
        </button>
      </div>

      <div className="flex gap-1 bg-bento-bg border border-bento-border rounded-2xl p-1">
        {(["join", "host"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError("");
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              tab === t ? "bg-zinc-900 text-white shadow" : "text-zinc-400 hover:text-white"
            }`}
          >
            {t === "join" ? "Join a room" : "Host a room"}
          </button>
        ))}
      </div>

      {error && <p className="text-xs font-mono text-rose-400">{error}</p>}

      {tab === "join" ? (
        <div className={`${card} space-y-4`}>
          <label className="text-[11px] font-mono text-zinc-500">Room code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC12"
            maxLength={5}
            className={`${input} font-mono tracking-[0.3em] text-center text-lg`}
          />
          <button
            onClick={() => enter(code)}
            disabled={busy || code.trim().length < 5}
            className={`${primaryBtn} w-full`}
          >
            <LogIn className="w-4 h-4" /> {busy ? "Joining…" : "Join room"}
          </button>
        </div>
      ) : createdCode ? (
        <div className={`${card} text-center space-y-4`}>
          <Trophy className="w-8 h-8 text-spotify mx-auto" />
          <div>
            <p className="text-[11px] font-mono text-zinc-500">Room code</p>
            <p className="text-4xl font-bold font-mono tracking-[0.2em] text-spotify mt-1">{createdCode}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-xs font-mono text-zinc-400 hover:text-spotify flex items-center gap-1.5 mx-auto cursor-pointer bg-transparent border-none transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Link copied" : "Copy invite link"}
          </button>
          <button onClick={() => enter(createdCode)} disabled={busy} className={`${primaryBtn} w-full`}>
            Start playing
          </button>
        </div>
      ) : (
        <div className={`${card} space-y-5`}>
          <div>
            <label className="text-[11px] font-mono text-zinc-500">Room name</label>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Friday night bangers"
              maxLength={40}
              className={`${input} mt-2`}
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-zinc-500">
              Songs ({picked.length}) — pick as many as you want
            </label>
            <div className="flex items-center bg-bento-bg border border-bento-border rounded-2xl px-4 py-3.5 mt-2 focus-within:border-spotify transition-all">
              <Search className="text-zinc-400 w-5 h-5 mr-3 flex-shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a song to add…"
                className="bg-transparent border-none text-white focus:outline-none w-full text-sm placeholder-zinc-500"
              />
            </div>

            {results.length > 0 && (
              <div className="mt-2 border border-bento-border rounded-2xl max-h-60 overflow-y-auto divide-y divide-bento-border/50">
                {results.map((song) => (
                  <button
                    key={song.id}
                    disabled={picked.some((s) => s.id === song.id) || !song.previewUrl}
                    onClick={() => {
                      setPicked((prev) => [...prev, song]);
                      setQuery("");
                      setResults([]);
                    }}
                    className="w-full flex items-center text-left px-4 py-3 hover:bg-zinc-900/60 disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    {song.artworkUrl ? (
                      <img
                        src={song.artworkUrl}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover mr-3 flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Music className="w-5 h-5 text-zinc-500 mr-3" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{song.title}</p>
                      <p className="text-xs text-zinc-400 truncate">
                        {song.artist}
                        {!song.previewUrl && " · no preview available"}
                      </p>
                    </div>
                    <Plus className="w-4 h-4 text-spotify ml-2 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {picked.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {picked.map((song, idx) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-bento-bg border border-bento-border/60"
                >
                  <span className="text-[10px] font-mono text-zinc-600 w-4">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{song.title}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{song.artist}</p>
                  </div>
                  <button
                    onClick={() => setPicked((prev) => prev.filter((s) => s.id !== song.id))}
                    aria-label={`Remove ${song.title}`}
                    className="text-zinc-500 hover:text-rose-400 cursor-pointer bg-transparent border-none transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleHost}
            disabled={busy || picked.length === 0}
            className={`${primaryBtn} w-full`}
          >
            {busy ? "Creating…" : `Create room with ${picked.length} song${picked.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}

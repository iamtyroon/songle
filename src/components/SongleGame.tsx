import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  SkipForward, 
  Search, 
  Volume2, 
  VolumeX, 
  Music, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Award, 
  Calendar, 
  Sparkles, 
  Share2,
  Clock,
  Check,
  ChevronRight,
  User,
  Trophy,
  Users,
  Flame,
  Lock,
  Unlock,
  Disc,
  Tag,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Song, searchiTunesSongs, PRESET_SONG_QUERIES, FALLBACK_SONGS } from "../data/songs";
import { 
  UserProfile, 
  submitUserScore, 
  fetchLeaderboard, 
  LeaderboardEntry,
  fetchUserTodayScore
} from "../lib/firebase";
import { advanceStreak, dayKey, effectiveStreak } from "../lib/streak";
import type { RoomPlayer, RoomResult } from "../lib/rooms";

const ATTEMPT_DURATIONS = [1, 2, 4, 7, 11, 16];
const MAX_DURATION = ATTEMPT_DURATIONS[ATTEMPT_DURATIONS.length - 1];

// Shared links always point at production, never at localhost. The ?v=2 suffix
// makes X treat this as a fresh URL so it re-crawls the social card instead of
// serving the cached, image-less entry from before the og tags existed.
const SHARE_URL = "https://play-songle.netlify.app/?v=2";

// Fixed pseudo-waveform envelope. Deterministic so the track looks like the same
// recording on every render instead of reshuffling under the playhead.
const WAVE = Array.from({ length: 72 }, (_, i) =>
  Math.min(
    1,
    0.22 +
      0.78 *
        Math.abs(
          Math.sin(i * 0.61) * 0.55 +
            Math.sin(i * 0.17) * 0.3 +
            Math.sin(i * 1.93) * 0.25
        )
  )
);

interface Guess {
  text: string;
  isCorrect: boolean;
  isSkip: boolean;
  title?: string;
  artist?: string;
  song?: Song;
}

interface GameStats {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
  distribution: number[];
  lastPlayedDate?: string;
}

/** Present only in room mode. Swaps the song source and the score destination. */
export interface RoomMode {
  name: string;
  songs: Song[];
  index: number;
  players: RoomPlayer[];
  onResult: (result: RoomResult) => void;
  onNext: () => void;
  onExit: () => void;
}

interface SongleGameProps {
  userProfile: UserProfile | null;
  onScoreSubmitted?: () => void;
  onOpenAuth?: () => void;
  showHowToPlay?: boolean;
  onOpenHowToPlay?: () => void;
  onCloseHowToPlay?: () => void;
  room?: RoomMode;
}

export default function SongleGame({
  userProfile,
  onScoreSubmitted,
  onOpenAuth,
  showHowToPlay = false,
  onOpenHowToPlay,
  onCloseHowToPlay,
  room
}: SongleGameProps) {
  // State management
  const [songList, setSongList] = useState<Song[]>(FALLBACK_SONGS);
  const [dailySong, setDailySong] = useState<Song>(FALLBACK_SONGS[0]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [currentAttempt, setCurrentAttempt] = useState<number>(0); // 0 to 5
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  // Game outcome
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [hasWon, setHasWon] = useState<boolean>(false);
  const [showResultsModal, setShowResultsModal] = useState<boolean>(false);
  const [shakeCard, setShakeCard] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string>("");
  const [speedBonus, setSpeedBonus] = useState<number>(100);
  const [helpTab, setHelpTab] = useState<"rules" | "clues">("rules");
  
  // Custom play options (let users choose other tracks to test)
  const [selectedSongIndex, setSelectedSongIndex] = useState<number>(0);
  const [dailyHasPlayed, setDailyHasPlayed] = useState<boolean>(false);
  const [isDailyRestoring, setIsDailyRestoring] = useState<boolean>(false);
  
  // Audio reference
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const speedTimerRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Stats loaded from localStorage
  const [stats, setStats] = useState<GameStats>({
    played: 0,
    wins: 0,
    streak: 0,
    maxStreak: 0,
    distribution: [0, 0, 0, 0, 0, 0]
  });

  // Load popular songs on mount. In room mode the host already picked the set.
  useEffect(() => {
    if (room) {
      setSongList(room.songs);
      setDailySong(room.songs[room.index]);
      setSelectedSongIndex(room.index);
      setIsLoading(false);
      return;
    }

    async function loadInitialSongs() {
      setIsLoading(true);
      try {
        // We'll search for preset queries and compile them
        const loaded: Song[] = [];
        
        // Fetch 5 songs from iTunes search dynamically to make it organic!
        // To be fast, we'll run search queries in parallel
        const promises = PRESET_SONG_QUERIES.slice(0, 8).map(async (term) => {
          try {
            const results = await searchiTunesSongs(term);
            if (results && results.length > 0) {
              return results[0];
            }
          } catch (e) {
            console.error("Single query failed", e);
          }
          return null;
        });

        const resolved = await Promise.all(promises);
        resolved.forEach((s) => {
          if (s) loaded.push(s);
        });

        if (loaded.length > 0) {
          setSongList(loaded);
          // Pick daily song based on the date
          const dateIndex = new Date().getDate() % loaded.length;
          setDailySong(loaded[dateIndex]);
          setSelectedSongIndex(dateIndex);
        } else {
          setSongList(FALLBACK_SONGS);
          setDailySong(FALLBACK_SONGS[0]);
          setSelectedSongIndex(0);
        }
      } catch (err) {
        console.error("Failed to load iTunes songs, falling back to static", err);
        setSongList(FALLBACK_SONGS);
        setDailySong(FALLBACK_SONGS[0]);
        setSelectedSongIndex(0);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadInitialSongs();
  }, [room?.index, room?.songs]);

  // Lock daily play once a day (State Restoration and Limit Verification)
  useEffect(() => {
    async function checkDailyPlayState() {
      if (room) return; // room songs have their own once-per-song lock in Firestore
      if (!dailySong || songList.length === 0) return;
      
      const dateIndex = new Date().getDate() % songList.length;
      const isDailySong = selectedSongIndex === dateIndex;
      
      if (!isDailySong) {
        // If they view another practice track, reset game state so they can practice
        // but keep dailyHasPlayed status intact so we know they solved the main daily song!
        setGameOver(false);
        setHasWon(false);
        setGuesses([]);
        setCurrentAttempt(0);
        return;
      }
      
      const dateStr = new Date().toISOString().split("T")[0];
      const localStateKey = `songle_daily_state_${dateStr}`;
      
      // 1. First, check local storage for responsive restoring
      const savedLocalState = localStorage.getItem(localStateKey);
      if (savedLocalState) {
        try {
          const parsed = JSON.parse(savedLocalState);
          if (parsed && Array.isArray(parsed.guesses)) {
            setGuesses(parsed.guesses);
            setGameOver(parsed.gameOver);
            setHasWon(parsed.hasWon);
            setCurrentAttempt(parsed.guesses.length);
            setDailyHasPlayed(true);
            return; // Successfully restored from local storage
          }
        } catch (e) {
          console.error("Failed to parse daily state from localStorage", e);
        }
      }
      
      // 2. Fall back/verify with Firestore if user is authenticated
      if (userProfile) {
        setIsDailyRestoring(true);
        try {
          const scoreData = await fetchUserTodayScore();
          if (scoreData) {
            // Restore state from Firestore score record
            const restoredGuesses = scoreData.guesses || [];
            setGuesses(restoredGuesses);
            setGameOver(true);
            setHasWon(scoreData.hasWon);
            setCurrentAttempt(restoredGuesses.length);
            setDailyHasPlayed(true);
            
            // Save to localStorage so we don't have to fetch it from Firestore on every reload
            localStorage.setItem(localStateKey, JSON.stringify({
              guesses: restoredGuesses,
              gameOver: true,
              hasWon: scoreData.hasWon
            }));
          } else {
            setDailyHasPlayed(false);
          }
        } catch (err) {
          console.error("Failed to fetch user score for daily restoration", err);
        } finally {
          setIsDailyRestoring(false);
        }
      } else {
        setDailyHasPlayed(false);
      }
    }
    
    checkDailyPlayState();
  }, [dailySong, selectedSongIndex, userProfile, songList]);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  // Sync profile stats
  useEffect(() => {
    if (userProfile && userProfile.stats) {
      setStats({
        played: userProfile.stats.played || 0,
        wins: userProfile.stats.wins || 0,
        streak: userProfile.stats.streak || 0,
        maxStreak: userProfile.stats.maxStreak || 0,
        distribution: userProfile.stats.distribution || [0, 0, 0, 0, 0, 0],
        lastPlayedDate: userProfile.stats.lastPlayedDate
      });
    } else {
      const savedStats = localStorage.getItem("songle_stats");
      if (savedStats) {
        try {
          setStats(JSON.parse(savedStats));
        } catch (e) {
          console.error("Error reading stats", e);
        }
      }
    }
  }, [userProfile]);

  const loadLeaderboardData = async () => {
    setIsLeaderboardLoading(true);
    try {
      const data = await fetchLeaderboard(10);
      setLeaderboard(data);
    } catch (e) {
      console.error("Failed to load leaderboard", e);
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboardData();
  }, [userProfile]);

  // Set up speed bonus countdown
  useEffect(() => {
    if (!gameOver && !isLoading) {
      speedTimerRef.current = window.setInterval(() => {
        setSpeedBonus((prev) => {
          if (prev <= 10) return 10;
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (speedTimerRef.current) clearInterval(speedTimerRef.current);
    };
  }, [gameOver, isLoading, currentAttempt]);

  // Handle active playback timing restrictions (stop audio at duration limit)
  useEffect(() => {
    if (isPlaying) {
      const limit = ATTEMPT_DURATIONS[currentAttempt];
      
      timerRef.current = window.setInterval(() => {
        if (audioRef.current) {
          const current = audioRef.current.currentTime;
          setCurrentTime(current);
          
          if (current >= limit) {
            pauseAudio();
          }
        }
      }, 50); // High precision
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentAttempt]);

  // Audio object initialization and cleanups
  useEffect(() => {
    // Reset audio when daily song changes
    pauseAudio();
    setCurrentTime(0);
    setCurrentAttempt(0);
    setGuesses([]);
    setGameOver(false);
    setHasWon(false);
    setSearchQuery("");
    setSpeedBonus(100);

    if (dailySong && dailySong.previewUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(dailySong.previewUrl);
      audioRef.current.muted = isMuted;
      audioRef.current.volume = 0.8;
      
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [dailySong]);

  // Update mute status
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Handle outside click to close dropdown search
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search autocomplete query
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        const results = await searchiTunesSongs(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 350); // Debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getPartialArtist = (artist: string) => {
    return artist.split(" ").map(word => {
      if (word.length <= 1) return word;
      // Mask internal characters with bullets, keeping first letter visible
      return word.charAt(0) + "•".repeat(word.length - 1);
    }).join(" ");
  };

  // Audio Control methods
  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error("Audio playback blocked or failed", err);
        });
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Skip Attempt
  const handleSkip = () => {
    const newGuesses = [...guesses, { text: "Skipped", isCorrect: false, isSkip: true }];
    setGuesses(newGuesses);
    setSearchQuery("");
    setSearchResults([]);

    if (currentAttempt < 5) {
      setCurrentAttempt((prev) => prev + 1);
      // Give feedback
      setCurrentTime(0);
      playAudio();
    } else {
      triggerLoss(newGuesses);
    }
  };

  // Submit Guess
  const handleGuess = (song: Song) => {
    const isCorrect = song.id === dailySong.id || 
                      (song.title.toLowerCase().trim() === dailySong.title.toLowerCase().trim() && 
                       song.artist.toLowerCase().trim() === dailySong.artist.toLowerCase().trim());

    const newGuesses = [
      ...guesses, 
      { 
        text: `${song.title} - ${song.artist}`, 
        isCorrect, 
        isSkip: false,
        title: song.title,
        artist: song.artist,
        song: song
      }
    ];
    setGuesses(newGuesses);
    setSearchQuery("");
    setSearchResults([]);

    if (isCorrect) {
      triggerWin(newGuesses);
    } else {
      setShakeCard(true);
      setTimeout(() => setShakeCard(false), 500);

      if (currentAttempt < 5) {
        setCurrentAttempt((prev) => prev + 1);
        setCurrentTime(0);
        // Play the newly unlocked audio duration for them
        setTimeout(() => playAudio(), 100);
      } else {
        triggerLoss(newGuesses);
      }
    }
  };

  const triggerWin = async (finalGuesses: Guess[]) => {
    setGameOver(true);
    setHasWon(true);
    pauseAudio();

    // Calculate score
    const attemptsUsed = finalGuesses.length;
    const baseScore = (6 - attemptsUsed) * 100;
    const finalScore = baseScore + speedBonus;

    // Room scores stay in the room: no global stats, no streak, no daily lock.
    if (room) {
      room.onResult({ songId: dailySong.id, score: finalScore, attempts: attemptsUsed, hasWon: true });
      return; // the reveal bar carries the Next control; the daily stats modal doesn't apply
    }

    // Save and update stats
    const nextStreak = advanceStreak(stats.streak, stats.lastPlayedDate, true);
    const updatedStats: GameStats = {
      played: stats.played + 1,
      wins: stats.wins + 1,
      streak: nextStreak,
      maxStreak: Math.max(stats.maxStreak, nextStreak),
      distribution: stats.distribution.map((val, idx) => {
        if (idx === attemptsUsed - 1) return val + 1;
        return val;
      }),
      lastPlayedDate: dayKey()
    };

    setStats(updatedStats);
    localStorage.setItem("songle_stats", JSON.stringify(updatedStats));

    // Save daily play state to local storage to lock play if it's the daily song
    const dateIndex = new Date().getDate() % songList.length;
    if (selectedSongIndex === dateIndex) {
      const dateStr = new Date().toISOString().split("T")[0];
      localStorage.setItem(`songle_daily_state_${dateStr}`, JSON.stringify({
        guesses: finalGuesses,
        gameOver: true,
        hasWon: true
      }));
      setDailyHasPlayed(true);
    }

    try {
      await submitUserScore(finalScore, attemptsUsed, true, finalGuesses, dailySong.title, dailySong.artist);
      if (onScoreSubmitted) {
        onScoreSubmitted();
      }
    } catch (e) {
      console.error("Firebase score submission error", e);
    }

    setShowResultsModal(true);
  };

  const triggerLoss = async (finalGuesses: Guess[]) => {
    setGameOver(true);
    setHasWon(false);
    pauseAudio();

    if (room) {
      room.onResult({ songId: dailySong.id, score: 0, attempts: finalGuesses.length, hasWon: false });
      return;
    }

    const updatedStats: GameStats = {
      ...stats,
      played: stats.played + 1,
      streak: 0, // a loss always breaks the run
      lastPlayedDate: dayKey()
    };

    setStats(updatedStats);
    localStorage.setItem("songle_stats", JSON.stringify(updatedStats));

    // Save daily play state to local storage to lock play if it's the daily song
    const dateIndex = new Date().getDate() % songList.length;
    if (selectedSongIndex === dateIndex) {
      const dateStr = new Date().toISOString().split("T")[0];
      localStorage.setItem(`songle_daily_state_${dateStr}`, JSON.stringify({
        guesses: finalGuesses,
        gameOver: true,
        hasWon: false
      }));
      setDailyHasPlayed(true);
    }

    try {
      await submitUserScore(0, finalGuesses.length, false, finalGuesses, dailySong.title, dailySong.artist);
      if (onScoreSubmitted) {
        onScoreSubmitted();
      }
    } catch (e) {
      console.error("Firebase loss score submission error", e);
    }

    setShowResultsModal(true);
  };

  // Generate shareable Emoji Grid
  const generateShareGrid = () => {
    let grid = "";
    for (let i = 0; i < 6; i++) {
      if (i < guesses.length) {
        const g = guesses[i];
        if (g.isCorrect) grid += "🟩";
        else if (g.isSkip) grid += "⬛";
        else grid += "🟥";
      } else {
        grid += "⬜";
      }
    }
    return grid;
  };

  const handleShare = () => {
    const emojiGrid = generateShareGrid();
    const attemptsText = hasWon ? `${guesses.length}/6` : "X/6";
    const scoreText = hasWon ? `Score: ${(6 - guesses.length) * 100 + speedBonus}` : "Score: 0";
    
    const textToCopy = `Songle - Daily Music Discovery 🎵\nDate: ${new Date().toLocaleDateString()}\nAttempt: ${attemptsText}\n${emojiGrid}\n${scoreText}\nPlay here: ${SHARE_URL}`;
    
    navigator.clipboard.writeText(textToCopy);
    setCopiedText("Copied results to clipboard!");
    setTimeout(() => setCopiedText(""), 3000);
  };

  // Reset Game for testing other songs (Playground mode)
  const selectDifferentSong = (idx: number) => {
    setSelectedSongIndex(idx);
    setDailySong(songList[idx]);
  };

  // Progress calculations
  const totalPlayableTime = ATTEMPT_DURATIONS[currentAttempt];
  const progressPercent = Math.min((currentTime / totalPlayableTime) * 100, 100);

  // Nothing writes to the record on a day the player never shows up, so the
  // stored streak stays stale until their next game. Decay it for display.
  const shownStreak = effectiveStreak(stats.streak, stats.lastPlayedDate);

  // The room board reuses the global board's markup; only the source differs.
  const boardEntries: LeaderboardEntry[] = room
    ? room.players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        photoURL: p.photoURL,
        points: p.totalScore,
        wins: p.results.filter((r) => r.hasWon).length,
        played: p.results.length,
        streak: 0
      }))
    : leaderboard;

  const isLastRoomSong = !!room && room.index >= room.songs.length - 1;

  return (
    <div className="w-full max-w-6xl mx-auto py-2 text-white">
      
      {/* Bento Grid Layout Wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Bento Cell: Main Core Gameplay Card (7 columns) */}
        <div className="lg:col-span-7 space-y-6">
          <motion.div 
            animate={shakeCard ? { x: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="w-full bg-bento-card border border-bento-border shadow-2xl rounded-3xl p-6 md:p-8 flex flex-col items-center relative overflow-hidden"
          >
            {/* Ambient background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-spotify/5 rounded-full blur-3xl pointer-events-none" />

            {/* Daily Played Notification */}
            {dailyHasPlayed && selectedSongIndex === (new Date().getDate() % songList.length) && (
              <div className="w-full mb-6 bg-spotify/10 border border-spotify/30 rounded-2xl p-4.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left z-10 relative">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-spotify/20 flex items-center justify-center text-spotify flex-shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
                      Today's song is done
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-spotify" />
                    </h4>
                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5 leading-relaxed">
                      Next one at midnight UTC.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowResultsModal(true)}
                  className="bg-spotify text-black hover:bg-spotify-hover text-xs font-bold px-4.5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  <Award className="w-4 h-4" /> View Results
                </button>
              </div>
            )}

            {/* Loading/Verifying Daily Status */}
            {isDailyRestoring && (
              <div className="w-full mb-6 bg-zinc-950/40 border border-bento-border/50 rounded-2xl p-4 flex items-center justify-center gap-3 z-10 relative">
                <div className="w-4 h-4 border-2 border-spotify border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-zinc-400">Checking today's play</span>
              </div>
            )}

            {/* Track timeline: unlocked window, playhead, and snippet tiers in one view */}
            <div className="w-full mb-7">
              <div className="flex items-end justify-between mb-3 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={toggleMute}
                    className="text-zinc-400 hover:text-white p-1.5 -ml-1.5 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  {/* Playing indicator — only motion in the header, and only when audio runs */}
                  <div className="flex items-end gap-0.5 h-3.5 w-3.5" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`w-[3px] h-full rounded-full ${isPlaying ? "bg-spotify eq-bar" : "bg-zinc-700"}`}
                        style={isPlaying ? { animationDelay: `${i * 0.16}s` } : undefined}
                      />
                    ))}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white leading-tight">
                      Snippet {currentAttempt + 1}
                      <span className="text-zinc-500 font-normal"> of 6</span>
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono leading-tight mt-0.5">
                      first {totalPlayableTime}s unlocked
                    </p>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono text-zinc-200 tabular-nums leading-tight">
                    {currentTime.toFixed(1)}
                    <span className="text-zinc-600">/{totalPlayableTime}s</span>
                  </p>
                  <p className="text-[11px] font-mono text-amber-500/90 leading-tight mt-0.5 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" /> +{speedBonus} speed
                  </p>
                </div>
              </div>

              {/* Waveform */}
              <div className="relative h-20 w-full select-none">
                <div className="absolute inset-0 flex items-center gap-[2px]">
                  {WAVE.map((amp, i) => {
                    const t = (i / WAVE.length) * MAX_DURATION;
                    const isPlayed = isPlaying && t <= currentTime;
                    const isUnlocked = t < totalPlayableTime;

                    let tone = "bg-zinc-800";
                    if (isUnlocked) tone = "bg-zinc-600";
                    if (isPlayed) tone = "bg-spotify";
                    if (gameOver) tone = isUnlocked ? (hasWon ? "bg-spotify" : "bg-rose-500/70") : "bg-zinc-800";

                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-colors duration-100 ${tone}`}
                        style={{ height: `${amp * 100}%` }}
                      />
                    );
                  })}
                </div>

                {/* Tier boundaries — where the next guess buys you more track */}
                {ATTEMPT_DURATIONS.slice(0, -1).map((dur, idx) => (
                  <div
                    key={dur}
                    className={`absolute top-0 bottom-0 w-px pointer-events-none ${
                      idx < currentAttempt ? "bg-spotify/40" : "bg-zinc-500/20"
                    }`}
                    style={{ left: `${(dur / MAX_DURATION) * 100}%` }}
                  />
                ))}

                {/* Playhead */}
                {isPlaying && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-white pointer-events-none shadow-[0_0_10px_2px] shadow-spotify/60"
                    style={{ left: `${Math.min((currentTime / MAX_DURATION) * 100, 100)}%` }}
                  />
                )}
              </div>

              <div className="relative h-4 mt-1.5">
                {ATTEMPT_DURATIONS.map((dur, idx) => (
                  <span
                    key={dur}
                    className={`absolute top-0 text-[10px] font-mono -translate-x-1/2 transition-colors ${
                      idx <= currentAttempt ? "text-zinc-400" : "text-zinc-700"
                    }`}
                    style={{
                      left: `${(dur / MAX_DURATION) * 100}%`,
                      transform: dur === MAX_DURATION ? "translateX(-100%)" : undefined
                    }}
                  >
                    {dur}s
                  </span>
                ))}
              </div>
            </div>

            {/* Play Controller button */}
            <div className="flex items-center justify-center gap-6 mb-8 w-full">
              <button
                onClick={handleSkip}
                disabled={gameOver}
                className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-bento-bg border border-transparent hover:border-bento-border transition cursor-pointer"
              >
                <SkipForward className="w-5 h-5 text-zinc-300" />
                <span className="text-[10px] font-mono tracking-wider uppercase font-semibold">Skip / +{(ATTEMPT_DURATIONS[currentAttempt + 1] || 16) - totalPlayableTime}s</span>
              </button>

              {/* Big Circle Play */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                onClick={isPlaying ? pauseAudio : playAudio}
                disabled={isLoading || gameOver}
                className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all border shadow-lg disabled:opacity-40 ${
                  isPlaying
                    ? "bg-rose-500/10 border-rose-500 text-rose-400 shadow-rose-500/10 ring-4 ring-rose-500/10"
                    : "bg-spotify text-black border-spotify shadow-xl shadow-spotify/30 ring-4 ring-spotify/15 hover:bg-spotify-hover hover:ring-spotify/25"
                }`}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 fill-current" />
                ) : (
                  <Play className="w-8 h-8 fill-current translate-x-0.5" />
                )}
              </motion.button>

              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    setCurrentTime(0);
                    playAudio();
                  }
                }}
                disabled={gameOver}
                className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl text-zinc-400 hover:text-white disabled:opacity-30 hover:bg-bento-bg border border-transparent hover:border-bento-border transition cursor-pointer"
              >
                <RotateCcw className="w-5 h-5 text-zinc-300" />
                <span className="text-[10px] font-mono tracking-wider uppercase font-semibold">Replay</span>
              </button>
            </div>

            {/* Compact Hints & Instructions Trigger */}
            <div className="w-full mb-6">
              <button
                onClick={onOpenHowToPlay}
                className="w-full bg-zinc-950/20 hover:bg-zinc-900/40 border border-bento-border/50 hover:border-spotify/30 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 transition-colors group cursor-pointer text-left"
              >
                <div className="min-w-0">
                  <h5 className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                    Stuck?
                    <span className="text-[10px] font-mono bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400 flex-shrink-0">
                      {guesses.length}/6 used
                    </span>
                  </h5>
                  <p className="text-[11px] text-zinc-500 font-mono mt-1 truncate">
                    Every guess unlocks another clue — year, album, then the artist.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-spotify font-mono flex-shrink-0">
                  <span className="hidden sm:inline">Rules &amp; clues</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </div>

            {/* Input Answer Section */}
            <div className="w-full relative" ref={dropdownRef}>
              <div className="flex items-center bg-bento-bg border border-bento-border rounded-2xl px-4 py-3.5 focus-within:border-spotify focus-within:ring-2 focus-within:ring-spotify/15 transition-all">
                <Search className="text-zinc-400 w-5 h-5 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  placeholder={gameOver ? "Game Completed!" : "Search artist, song, or keywords..."}
                  disabled={gameOver}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-white focus:outline-none w-full text-sm placeholder-zinc-500"
                />
                {isSearching && (
                  <div className="w-5 h-5 border-2 border-spotify border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
              </div>

              {/* Autocomplete Dropdown */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute z-30 left-0 right-0 mt-2 bg-bento-card border border-bento-border rounded-2xl max-h-60 overflow-y-auto shadow-2xl divide-y divide-bento-border/50"
                  >
                    {searchResults.map((song) => (
                      <button
                        key={song.id}
                        onClick={() => handleGuess(song)}
                        className="w-full flex items-center text-left px-4 py-3.5 hover:bg-zinc-900/60 transition-colors cursor-pointer"
                      >
                        {song.artworkUrl ? (
                          <img 
                            src={song.artworkUrl} 
                            alt={song.title} 
                            className="w-10 h-10 rounded-lg object-cover mr-3 border border-bento-border flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-bento-bg rounded-lg flex items-center justify-center mr-3 flex-shrink-0 border border-bento-border">
                            <Music className="w-5 h-5 text-zinc-500" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                          <p className="text-xs text-zinc-400 truncate mt-0.5">{song.artist}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-500 ml-2" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Guess Logs history */}
            <div className="w-full mt-6 flex flex-col gap-2.5">
              {Array.from({ length: 6 }).map((_, idx) => {
                const guess = guesses[idx];
                
                if (guess) {
                  const isSkipped = guess.isSkip;
                  const isCorrect = guess.isCorrect;
                  const guessedSong = guess.song;

                  // Comparison results
                  const matchesArtist = guessedSong && dailySong && 
                    guessedSong.artist.toLowerCase().trim() === dailySong.artist.toLowerCase().trim();
                  
                  const matchesAlbum = guessedSong && dailySong && guessedSong.album && dailySong.album &&
                    guessedSong.album.toLowerCase().trim() === dailySong.album.toLowerCase().trim();
                    
                  const matchesGenre = guessedSong && dailySong && guessedSong.genre && dailySong.genre &&
                    guessedSong.genre.toLowerCase().trim() === dailySong.genre.toLowerCase().trim();

                  let yearBadgeColor = "bg-zinc-900/60 border-bento-border/50 text-zinc-500";
                  let yearArrow = "";
                  let yearText = "Wrong Year";

                  if (guessedSong && dailySong && guessedSong.releaseYear && dailySong.releaseYear) {
                    if (guessedSong.releaseYear === dailySong.releaseYear) {
                      yearBadgeColor = "bg-spotify/10 border-spotify/40 text-spotify";
                      yearText = `${guessedSong.releaseYear}`;
                    } else if (guessedSong.releaseYear < dailySong.releaseYear) {
                      yearBadgeColor = "bg-amber-500/10 border-amber-500/30 text-amber-400";
                      yearText = `${guessedSong.releaseYear}`;
                      yearArrow = "up"; // Target is newer
                    } else {
                      yearBadgeColor = "bg-amber-500/10 border-amber-500/30 text-amber-400";
                      yearText = `${guessedSong.releaseYear}`;
                      yearArrow = "down"; // Target is older
                    }
                  } else if (guessedSong && guessedSong.releaseYear) {
                    yearText = `${guessedSong.releaseYear}`;
                  }

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: -6, scale: 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className={`flex flex-col gap-2 px-4 py-3.5 rounded-2xl border text-sm font-medium ${
                        isCorrect
                          ? "bg-spotify/10 border-spotify/40 text-spotify"
                          : isSkipped
                            ? "bg-zinc-900/40 border-bento-border text-zinc-400"
                            : "bg-zinc-950/40 border-bento-border text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono bg-zinc-900 border border-bento-border px-2 py-0.5 rounded-md text-zinc-300 flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate font-semibold text-white">
                            {guess.text}
                          </span>
                        </div>
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-spotify flex-shrink-0" />
                        ) : isSkipped ? (
                          <SkipForward className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        )}
                      </div>

                      {/* Attribute comparisons for active guess */}
                      {/* Each chip shows what you guessed; green means it matches today's song */}
                      {!isSkipped && guessedSong && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {[
                            { Icon: User, value: guessedSong.artist, ok: !!matchesArtist, axis: "Artist" },
                            { Icon: Disc, value: guessedSong.album || "Single", ok: !!matchesAlbum, axis: "Album" },
                            { Icon: Tag, value: guessedSong.genre || "Unknown", ok: !!matchesGenre, axis: "Genre" }
                          ].map(({ Icon, value, ok, axis }) => (
                            <div
                              key={axis}
                              title={`${axis}: ${value}${ok ? " — matches" : ""}`}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono max-w-[170px] ${
                                ok
                                  ? "bg-spotify/10 border-spotify/40 text-spotify"
                                  : "bg-zinc-900/60 border-bento-border/50 text-zinc-500"
                              }`}
                            >
                              <Icon className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{value}</span>
                              {ok && <Check className="w-3 h-3 flex-shrink-0" />}
                            </div>
                          ))}

                          {/* Year, with an arrow pointing toward the answer */}
                          <div
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono ${yearBadgeColor}`}
                            title={
                              guessedSong.releaseYear === dailySong.releaseYear
                                ? "Same year as the answer"
                                : yearArrow === "up"
                                  ? "The answer is newer than this"
                                  : "The answer is older than this"
                            }
                          >
                            <Calendar className="w-3 h-3" />
                            <span>{yearText}</span>
                            {yearArrow === "up" && <ArrowUp className="w-3 h-3" />}
                            {yearArrow === "down" && <ArrowDown className="w-3 h-3" />}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                }

                // Empty slots (future attempts)
                return (
                  <div 
                    key={idx} 
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-dashed border-bento-border/60 bg-bento-bg/20"
                  >
                    <span className="text-xs font-mono bg-bento-bg text-zinc-700 px-2 py-0.5 rounded-md border border-bento-border/50">
                      {idx + 1}
                    </span>
                    <span className="sr-only">Guess {idx + 1}, not used yet</span>
                  </div>
                );
              })}
            </div>

            {/* If GameOver, Show primary Reveal Actions */}
            {gameOver && (
              <div className="mt-6 w-full flex flex-col gap-4">
                <div className="bg-bento-bg border border-bento-border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full">
                    {/* The song resolving out of the snippet — the one authored moment */}
                    <motion.img
                      src={dailySong.artworkUrl}
                      alt={`Album art for ${dailySong.title} by ${dailySong.artist}`}
                      initial={{ filter: "blur(14px)", scale: 1.12, opacity: 0 }}
                      animate={{ filter: "blur(0px)", scale: 1, opacity: 1 }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className="w-20 h-20 rounded-xl object-cover border border-bento-border shadow-lg shadow-black/40 flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <motion.div
                      className="min-w-0"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <p className={`text-[11px] font-mono mb-1 ${hasWon ? "text-spotify" : "text-rose-400"}`}>
                        {hasWon ? "You got it" : "It was"}
                      </p>
                      <h4 className="text-lg font-bold text-white truncate font-display">{dailySong.title}</h4>
                      <p className="text-sm text-zinc-400 truncate mt-0.5">{dailySong.artist}</p>
                    </motion.div>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    {room ? (
                      <button
                        onClick={isLastRoomSong ? room.onExit : room.onNext}
                        className="flex-1 md:flex-none bg-spotify text-black hover:bg-spotify-hover px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-spotify/10 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer font-display"
                      >
                        {isLastRoomSong ? (
                          <><Trophy className="w-4 h-4" /> Finish room</>
                        ) : (
                          <><ChevronRight className="w-4 h-4" /> Next song</>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowResultsModal(true)}
                        className="flex-1 md:flex-none bg-spotify text-black hover:bg-spotify-hover px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-spotify/10 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer font-display"
                      >
                        <Award className="w-4 h-4" /> View Stats
                      </button>
                    )}
                    <a
                      href={dailySong.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 md:flex-none bg-zinc-900 text-white hover:bg-zinc-800 px-4 py-2.5 rounded-xl font-bold text-sm transition border border-bento-border flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Music className="w-4 h-4 text-spotify" /> Play on Spotify
                    </a>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Bento Column: Stats, Playground & Game Metadata (5 columns) */}
        <div className="lg:col-span-5 space-y-6 flex flex-col">
          
          {/* Subcard 1: Active Game Meta / Calendar */}
          <div className="bg-bento-card border border-bento-border rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-spotify/5 rounded-full blur-2xl pointer-events-none" />
            {room ? (
              <div className="relative">
                <p className="text-[11px] text-zinc-500 font-mono">Challenge room</p>
                <p className="text-2xl font-bold text-white font-display leading-none mt-1.5 truncate">
                  {room.name}
                </p>
                <p className="text-[11px] text-zinc-400 font-mono mt-3">
                  Song {room.index + 1} of {room.songs.length}
                </p>
                <div className="h-1.5 bg-bento-bg rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-spotify rounded-full transition-[width] duration-500"
                    style={{ width: `${((room.index + 1) / room.songs.length) * 100}%` }}
                  />
                </div>
                <button
                  onClick={room.onExit}
                  className="text-[11px] text-zinc-500 hover:text-spotify font-mono mt-5 pt-4 border-t border-bento-border/60 w-full text-left cursor-pointer bg-transparent border-x-0 border-b-0 transition-colors"
                >
                  Leave room
                </button>
              </div>
            ) : (
              <div className="relative">
                <p className="text-[11px] text-zinc-500 font-mono">
                  {new Date().toLocaleDateString("en-US", { weekday: 'long' })}
                </p>
                <p className="text-2xl font-bold text-white font-display leading-none mt-1.5">
                  {new Date().toLocaleDateString("en-US", { month: 'long', day: 'numeric' })}
                </p>

                <p className="text-[11px] text-zinc-500 font-mono mt-5 pt-4 border-t border-bento-border/60 leading-relaxed">
                  Everyone hears the same song today. A new one drops at midnight UTC.
                </p>
              </div>
            )}
          </div>

          {/* Subcard 2: Cumulative Dashboard Stats Widget (daily only — room scores don't touch it) */}
          <div className={`bg-bento-card border border-bento-border rounded-3xl p-6 shadow-xl flex-col ${room ? "hidden" : "flex"}`}>
            <h4 className="text-sm font-bold text-white font-display">Your record</h4>

            <div className="grid grid-cols-4 mt-5 divide-x divide-bento-border/60">
              {[
                { label: "Played", value: stats.played, tone: "text-white" },
                {
                  label: "Win rate",
                  value: `${stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0}%`,
                  tone: "text-spotify"
                },
                { label: "Streak", value: shownStreak, tone: "text-amber-500" },
                { label: "Best", value: stats.maxStreak, tone: "text-white" }
              ].map(({ label, value, tone }) => (
                <div key={label} className="px-2 first:pl-0 last:pr-0">
                  <p className={`text-2xl font-bold font-display tabular-nums leading-none ${tone}`}>{value}</p>
                  <p className="text-[11px] text-zinc-500 font-mono mt-1.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-bento-border/60">
              <p className="text-[11px] text-zinc-500 font-mono mb-3">Solved on guess</p>
              <div className="flex flex-col gap-1.5">
                {stats.distribution.map((val, idx) => {
                  const max = Math.max(...stats.distribution, 1);
                  const widthPercent = (val / max) * 100;
                  const isJustSolved = guesses.length === idx + 1 && hasWon;

                  return (
                    <div key={idx} className="flex items-center gap-2.5 text-xs">
                      <span className="w-2 font-mono text-zinc-600 text-[10px] tabular-nums">{idx + 1}</span>
                      <div className="flex-1 h-4 relative border-b border-bento-border/50">
                        {val > 0 && (
                          <div
                            style={{ width: `${Math.max(widthPercent, 10)}%` }}
                            className={`h-full rounded-r-sm flex items-center justify-end px-1.5 text-[10px] font-mono font-bold transition-[width] duration-500 ease-out ${
                              isJustSolved ? "bg-spotify text-black" : "bg-spotify/25 text-spotify"
                            }`}
                          >
                            {val}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Subcard 3: Global Leaderboard Widget */}
          <div className="bg-bento-card border border-bento-border rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col">
            <div className="flex justify-between items-baseline mb-5">
              <h4 className="text-sm font-bold text-white font-display flex items-baseline gap-2">
                {room ? "Room board" : "Today's board"}
                <Trophy className="text-amber-500 w-3.5 h-3.5 self-center" />
              </h4>

              {room ? (
                <span className="text-[11px] font-mono text-zinc-500">Live</span>
              ) : (
                <button
                  onClick={loadLeaderboardData}
                  className="text-[11px] font-mono text-zinc-500 hover:text-spotify transition-colors cursor-pointer border-none bg-transparent"
                >
                  Refresh
                </button>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-between">
              {isLeaderboardLoading && !room ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-2">
                  <div className="w-6 h-6 border-2 border-spotify border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-mono text-zinc-500">Loading scores</p>
                </div>
              ) : boardEntries.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-1">
                  <Users className="w-8 h-8 text-zinc-600" />
                  <p className="text-xs font-semibold text-zinc-400">
                    {room ? "Nobody has scored yet" : "No scores yet today"}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-500">Solve the song to take the top spot.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent">
                  {boardEntries.map((entry, idx) => {
                    const isSelf = userProfile?.uid === entry.uid;
                    let rankBadge = "text-zinc-400 font-mono";
                    if (idx === 0) rankBadge = "text-amber-400 font-bold";
                    else if (idx === 1) rankBadge = "text-zinc-300 font-bold";
                    else if (idx === 2) rankBadge = "text-amber-700 font-bold";

                    return (
                      <div 
                        key={entry.uid}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                          isSelf
                            ? "bg-spotify/10 text-spotify"
                            : "text-zinc-300 hover:bg-zinc-900/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-4 text-center text-[10px] ${rankBadge}`}>
                            #{idx + 1}
                          </span>
                          
                          <img 
                            src={entry.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(entry.displayName)}`} 
                            alt={entry.displayName} 
                            className="w-6 h-6 rounded-full border border-bento-border/50 bg-zinc-900 object-cover flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          
                          <span className="truncate font-semibold text-[11px] text-white">
                            {entry.displayName} {isSelf && <span className="text-[9px] font-mono bg-spotify text-black font-bold px-1 rounded-sm ml-0.5 uppercase">You</span>}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {entry.streak > 0 && (
                            <div className="flex items-center gap-0.5 text-orange-400 text-[10px] font-mono font-bold" title={`${entry.streak}-day winning streak`}>
                              <Flame className="w-3 h-3 fill-current" />
                              <span>{entry.streak}</span>
                            </div>
                          )}
                          <div className="text-right flex-shrink-0">
                            <span className="text-[11px] font-mono font-bold text-spotify">{entry.points} pts</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!userProfile && (
                <div className="mt-4 pt-4 border-t border-bento-border/60">
                  <button
                    onClick={onOpenAuth}
                    className="text-[11px] text-zinc-400 hover:text-spotify font-mono cursor-pointer border-none bg-transparent transition-colors"
                  >
                    Sign in to keep your streak and take a spot here.
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* MODAL overlay for score / stats */}
      <AnimatePresence>
        {showResultsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bento-bg/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-bento-card border border-bento-border rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-white"
            >
              {/* Close Button */}
              <button 
                onClick={() => setShowResultsModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 p-2 rounded-full transition border border-bento-border cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center mt-2">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${hasWon ? "bg-spotify/20 text-spotify" : "bg-rose-500/20 text-rose-400"}`}>
                  <Award className="w-8 h-8" />
                </div>
                
                <h3 className="text-xl font-bold font-display px-8">
                  {hasWon
                    ? `Got it in ${guesses.length} ${guesses.length === 1 ? "guess" : "guesses"}`
                    : "Out of guesses"}
                </h3>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  {hasWon ? `${(6 - guesses.length) * 100 + speedBonus} points` : "The streak resets — back tomorrow."}
                </p>

                {/* Cover Art Card */}
                <div className="my-5 bg-bento-bg border border-bento-border rounded-2xl p-3.5 w-full flex items-center gap-4 text-left">
                  <img 
                    src={dailySong.artworkUrl} 
                    alt={dailySong.title} 
                    className="w-16 h-16 rounded-xl object-cover border border-bento-border flex-shrink-0 shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-zinc-500 font-mono">Today's song</p>
                    <p className="font-bold text-white truncate text-base mt-0.5">{dailySong.title}</p>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{dailySong.artist} • <span className="italic text-zinc-500">{dailySong.album}</span></p>
                  </div>
                </div>

                {/* Score Emoji grid representation */}
                <div className="bg-bento-bg border border-bento-border p-4 rounded-2xl w-full mb-6">
                  <p className="text-[10px] text-zinc-400 font-mono mb-2.5">Your six slots</p>
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    {Array.from({ length: 6 }).map((_, idx) => {
                      const g = guesses[idx];
                      let color = "bg-zinc-950 border-bento-border";
                      let icon = null;
                      
                      if (g) {
                        if (g.isCorrect) {
                          color = "bg-spotify/20 border-spotify text-spotify";
                          icon = <Check className="w-3.5 h-3.5" />;
                        } else if (g.isSkip) {
                          color = "bg-zinc-900 border-zinc-800 text-zinc-500";
                          icon = <SkipForward className="w-3 h-3" />;
                        } else {
                          color = "bg-rose-500/20 border-rose-500 text-rose-400";
                          icon = <XCircle className="w-3 h-3" />;
                        }
                      }

                      return (
                        <div 
                          key={idx} 
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs transition-colors ${color}`}
                        >
                          {icon}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-4 text-[10px] font-mono text-zinc-500">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-spotify rounded-sm" /> Win</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" /> Fail</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-zinc-600 rounded-sm" /> Skip</span>
                  </div>
                </div>

                {/* Cumulative Stats Grid */}
                <div className="grid grid-cols-4 w-full mb-6 divide-x divide-bento-border/60 text-left">
                  {[
                    { label: "Played", value: stats.played, tone: "text-white" },
                    {
                      label: "Win rate",
                      value: `${stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0}%`,
                      tone: "text-spotify"
                    },
                    { label: "Streak", value: shownStreak, tone: "text-amber-500" },
                    { label: "Best", value: stats.maxStreak, tone: "text-white" }
                  ].map(({ label, value, tone }) => (
                    <div key={label} className="px-3 first:pl-0 last:pr-0">
                      <p className={`text-xl font-bold font-display tabular-nums leading-none ${tone}`}>{value}</p>
                      <p className="text-[11px] text-zinc-500 font-mono mt-1.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Action CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5 w-full mt-2">
                  <button
                    onClick={handleShare}
                    className="flex-1 bg-spotify hover:bg-spotify-hover text-black font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-spotify/10 cursor-pointer font-display"
                  >
                    <Share2 className="w-4 h-4" /> Share Results
                  </button>
                  <a
                    href={dailySong.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3 px-4 rounded-xl border border-bento-border transition flex items-center justify-center gap-2 cursor-pointer font-display"
                  >
                    <Music className="w-4 h-4 text-spotify" /> Play on Spotify
                  </a>
                </div>

                {copiedText && (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="text-xs text-spotify font-mono mt-3"
                  >
                    {copiedText}
                  </motion.p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* How To Play & Clues Modal */}
      <AnimatePresence>
        {showHowToPlay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bento-bg/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-bento-card border border-bento-border rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-white flex flex-col max-h-[90vh]"
            >
              {/* Close Button */}
              <button 
                onClick={onCloseHowToPlay}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 p-2 rounded-full transition border border-bento-border cursor-pointer z-10"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-bold flex items-center gap-2 text-white mb-4 pr-10 font-display">
                <Sparkles className="text-spotify w-5 h-5 flex-shrink-0" /> How to play
              </h3>

              {/* Tabs Switcher */}
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-bento-border/60 mb-5 flex-shrink-0">
                <button
                  onClick={() => setHelpTab("rules")}
                  className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition cursor-pointer font-display ${
                    helpTab === "rules" ? "bg-zinc-900 text-white shadow" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Game Rules
                </button>
                <button
                  onClick={() => setHelpTab("clues")}
                  className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 font-display ${
                    helpTab === "clues" ? "bg-zinc-900 text-spotify shadow animate-none" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Clue Hub
                  <span className="text-[10px] font-mono bg-zinc-850 text-zinc-400 px-2 py-0.2 rounded-full font-bold">
                    {guesses.length}
                  </span>
                </button>
              </div>

              {/* Scrollable Tab Content */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {helpTab === "rules" ? (
                  <div className="space-y-4 text-sm text-zinc-300">
                    <p>
                      One song a day, the same one for everybody. You hear one second of it. Name it, or spend a guess to hear more.
                    </p>
                    <div className="bg-bento-bg p-3.5 rounded-2xl border border-bento-border font-mono text-xs space-y-2">
                      <div className="flex justify-between text-zinc-400"><span>Attempt 1:</span> <span className="text-spotify font-bold">1 second</span></div>
                      <div className="flex justify-between text-zinc-400"><span>Attempt 2:</span> <span className="text-zinc-300 font-bold">2 seconds</span></div>
                      <div className="flex justify-between text-zinc-400"><span>Attempt 3:</span> <span className="text-zinc-300 font-bold">4 seconds</span></div>
                      <div className="flex justify-between text-zinc-400"><span>Attempt 4:</span> <span className="text-zinc-300 font-bold">7 seconds</span></div>
                      <div className="flex justify-between text-zinc-400"><span>Attempt 5:</span> <span className="text-zinc-300 font-bold">11 seconds</span></div>
                      <div className="flex justify-between text-zinc-400"><span>Attempt 6:</span> <span className="text-rose-400 font-bold">16 seconds</span></div>
                    </div>
                    <p>
                      Search by artist or title — results come straight from iTunes, so you can only guess songs that actually exist.
                    </p>
                    <p>
                      A wrong guess or a skip buys you the next chunk of audio. Fewer guesses and less time on the clock means a higher score.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-400">
                      Every guess you spend reveals one more detail about today's song.
                    </p>
                    
                    <div className="grid grid-cols-1 gap-2.5 text-xs mt-2">
                      {/* Clue 1: Year and Genre */}
                      <div className="bg-zinc-900/40 border border-bento-border/30 px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Calendar className="w-4 h-4 text-spotify flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase">Release Year & Genre</p>
                            <p className="font-semibold text-zinc-100 mt-0.5 truncate">
                              {dailySong.releaseYear || "Unknown"} • {dailySong.genre || "Pop/Alternative"}
                            </p>
                          </div>
                        </div>
                        <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider flex-shrink-0">Always Visible</span>
                      </div>

                      {/* Clue 2: Artist Initial & Word Count */}
                      <div className="bg-zinc-900/40 border border-bento-border/30 px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <User className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase">Artist Hint</p>
                            <p className="font-semibold text-zinc-100 mt-0.5 truncate">
                              {guesses.length >= 1 || gameOver ? (
                                <span>Starts with <strong className="text-spotify font-semibold">"{dailySong.artist.charAt(0)}"</strong> ({dailySong.artist.split(" ").length} words)</span>
                              ) : (
                                <span className="text-zinc-500 italic">Guess 1 time to unlock</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {guesses.length >= 1 || gameOver ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                        )}
                      </div>

                      {/* Clue 3: Song Title Initial & Length */}
                      <div className="bg-zinc-900/40 border border-bento-border/30 px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Music className="w-4 h-4 text-pink-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase">Song Title Hint</p>
                            <p className="font-semibold text-zinc-100 mt-0.5 truncate">
                              {guesses.length >= 2 || gameOver ? (
                                <span>Starts with <strong className="text-pink-400 font-semibold">"{dailySong.title.charAt(0)}"</strong> ({dailySong.title.length} chars)</span>
                              ) : (
                                <span className="text-zinc-500 italic">Guess 2 times to unlock</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {guesses.length >= 2 || gameOver ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                        )}
                      </div>

                      {/* Clue 4: Album Name */}
                      <div className="bg-zinc-900/40 border border-bento-border/30 px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Disc className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase">Album Name</p>
                            <p className="font-semibold text-zinc-100 mt-0.5 truncate">
                              {guesses.length >= 3 || gameOver ? (
                                <span>{dailySong.album || "Single"}</span>
                              ) : (
                                <span className="text-zinc-500 italic">Guess 3 times to unlock</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {guesses.length >= 3 || gameOver ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                        )}
                      </div>

                      {/* Clue 5: Partial Artist Name */}
                      <div className="bg-zinc-900/40 border border-bento-border/30 px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase">Partial Artist Mask</p>
                            <p className="font-semibold text-zinc-100 mt-0.5 tracking-widest font-mono text-[11px] truncate">
                              {guesses.length >= 4 || gameOver ? (
                                <span className="text-spotify font-sans tracking-widest">{getPartialArtist(dailySong.artist)}</span>
                              ) : (
                                <span className="text-zinc-500 italic font-sans tracking-normal">Guess 4 times to unlock</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {guesses.length >= 4 || gameOver ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                        )}
                      </div>

                      {/* Clue 6: Full Artist Name Reveal */}
                      <div className="bg-zinc-900/40 border border-bento-border/30 px-3.5 py-2.5 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Flame className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase">Full Artist Reveal</p>
                            <p className="font-semibold text-zinc-100 mt-0.5 truncate">
                              {guesses.length >= 5 || gameOver ? (
                                <span className="text-orange-400 font-bold">{dailySong.artist}</span>
                              ) : (
                                <span className="text-zinc-500 italic">Guess 5 times to unlock</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {guesses.length >= 5 || gameOver ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={onCloseHowToPlay}
                className="mt-6 w-full bg-spotify hover:bg-spotify-hover text-black font-bold py-3 rounded-2xl transition shadow-lg shadow-spotify/15 cursor-pointer font-display flex-shrink-0"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

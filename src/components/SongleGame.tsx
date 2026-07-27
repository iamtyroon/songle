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
  TrendingUp, 
  HelpCircle, 
  Clock,
  Check,
  ChevronRight,
  User,
  Activity,
  AlertCircle,
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

const ATTEMPT_DURATIONS = [1, 2, 4, 7, 11, 16];

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
}

interface SongleGameProps {
  userProfile: UserProfile | null;
  onScoreSubmitted?: () => void;
  onOpenAuth?: () => void;
  showHowToPlay?: boolean;
  onOpenHowToPlay?: () => void;
  onCloseHowToPlay?: () => void;
}

export default function SongleGame({ 
  userProfile, 
  onScoreSubmitted, 
  onOpenAuth,
  showHowToPlay = false,
  onOpenHowToPlay,
  onCloseHowToPlay
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

  // Load popular songs on mount
  useEffect(() => {
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
  }, []);

  // Lock daily play once a day (State Restoration and Limit Verification)
  useEffect(() => {
    async function checkDailyPlayState() {
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
        distribution: userProfile.stats.distribution || [0, 0, 0, 0, 0, 0]
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

    // Save and update stats
    const updatedStats = {
      played: stats.played + 1,
      wins: stats.wins + 1,
      streak: stats.streak + 1,
      maxStreak: Math.max(stats.maxStreak, stats.streak + 1),
      distribution: stats.distribution.map((val, idx) => {
        if (idx === attemptsUsed - 1) return val + 1;
        return val;
      })
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

    const updatedStats = {
      ...stats,
      played: stats.played + 1,
      streak: 0 // Reset streak
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
    
    const textToCopy = `Songle - Daily Music Discovery 🎵\nDate: ${new Date().toLocaleDateString()}\nAttempt: ${attemptsText}\n${emojiGrid}\n${scoreText}\nPlay here: ${window.location.href}`;
    
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
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 justify-center sm:justify-start">
                      Daily Songle Completed <span className="inline-block w-2 h-2 rounded-full bg-spotify animate-ping" />
                    </h4>
                    <p className="text-[10px] text-zinc-300 font-mono mt-0.5 leading-relaxed">
                      You've already solved today's daily discovery! Come back tomorrow.
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
                <span className="text-xs font-mono text-zinc-400">Verifying Daily Play Lock...</span>
              </div>
            )}

            {/* Dynamic Sound Wave Visualizer when playing */}
            <div className="flex items-end justify-center gap-1.5 h-16 mb-6 w-full max-w-xs">
              {Array.from({ length: 24 }).map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-1 rounded-full ${gameOver && hasWon ? "bg-spotify" : isPlaying ? "bg-spotify" : "bg-zinc-800"}`}
                  animate={isPlaying ? {
                    height: [12, Math.floor(Math.random() * 48) + 12, 12]
                  } : { height: 6 }}
                  transition={isPlaying ? {
                    duration: 0.5 + (i % 4) * 0.1,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : { duration: 0.2 }}
                />
              ))}
            </div>

            {/* Progress Timeline Segments */}
            <div className="w-full mb-6">
              <div className="flex justify-between items-center text-xs font-mono text-zinc-400 mb-2">
                <span className="font-semibold tracking-wide">Snippets Unlocked: {currentAttempt + 1} / 6</span>
                <div className="flex items-center gap-1 bg-zinc-900/60 border border-bento-border px-2 py-0.5 rounded-md">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-500 font-semibold text-[11px]">Speed Bonus: +{speedBonus}</span>
                </div>
              </div>
              
              {/* Segmented bar */}
              <div className="grid grid-cols-6 gap-1 w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-bento-border/50">
                {ATTEMPT_DURATIONS.map((dur, idx) => {
                  const isActive = idx <= currentAttempt;
                  const isCurrent = idx === currentAttempt;
                  
                  let barColor = "bg-zinc-900";
                  if (isActive) {
                    barColor = "bg-zinc-700";
                  }
                  if (isCurrent) {
                    barColor = isPlaying ? "bg-spotify animate-pulse" : "bg-spotify";
                  }
                  if (gameOver) {
                    barColor = hasWon ? "bg-spotify" : "bg-rose-500";
                  }

                  return (
                    <div 
                      key={idx} 
                      className={`h-full transition-all duration-300 rounded-full ${barColor}`} 
                      title={`Level ${idx + 1}: ${dur}s`}
                    />
                  );
                })}
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 mt-2 px-1">
                <span>1s</span>
                <span>2s</span>
                <span>4s</span>
                <span>7s</span>
                <span>11s</span>
                <span>16s (Max)</span>
              </div>
            </div>

            {/* Audio Visual Timer Bar */}
            <div className="w-full bg-bento-bg px-4 py-3.5 rounded-2xl border border-bento-border flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button 
                  onClick={toggleMute}
                  className="text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-zinc-900 transition cursor-pointer"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-zinc-300" />}
                </button>
                <span className="text-xs text-zinc-400 font-mono">
                  Listening Window: <span className="text-spotify font-medium">0s - {totalPlayableTime}s</span>
                </span>
              </div>

              <div className="text-xs font-mono text-zinc-300 font-semibold bg-bento-card px-2.5 py-1 rounded-lg border border-bento-border">
                {currentTime.toFixed(1)}s / {totalPlayableTime}s
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
                    ? "bg-rose-500/10 border-rose-500 text-rose-400 shadow-rose-500/10" 
                    : "bg-spotify text-black border-spotify shadow-spotify/20 hover:bg-spotify-hover"
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
                className="w-full bg-zinc-950/20 hover:bg-zinc-900/40 border border-bento-border/50 hover:border-spotify/30 rounded-2xl p-4.5 flex items-center justify-between transition group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-spotify/10 flex items-center justify-center text-spotify group-hover:scale-105 transition-transform flex-shrink-0">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                      Need a Hint?
                      <span className="text-[9px] font-mono bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400">
                        {guesses.length} / 6 Guesses
                      </span>
                    </h5>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                      Unlock progress-based clues (Year, Genre, Album, and Artist reveals)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-spotify font-semibold font-mono flex-shrink-0">
                  <span>How to Play & Clues</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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

                  let yearBadgeColor = "bg-zinc-900/50 border-bento-border/40 text-zinc-500";
                  let yearArrow = "";
                  let yearText = "Wrong Year";

                  if (guessedSong && dailySong && guessedSong.releaseYear && dailySong.releaseYear) {
                    if (guessedSong.releaseYear === dailySong.releaseYear) {
                      yearBadgeColor = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
                      yearText = `${guessedSong.releaseYear}`;
                    } else if (guessedSong.releaseYear < dailySong.releaseYear) {
                      yearBadgeColor = "bg-amber-500/10 border-amber-500/30 text-amber-400";
                      yearText = `${guessedSong.releaseYear}`;
                      yearArrow = "🔼"; // Target is newer
                    } else {
                      yearBadgeColor = "bg-amber-500/10 border-amber-500/30 text-amber-400";
                      yearText = `${guessedSong.releaseYear}`;
                      yearArrow = "🔽"; // Target is older
                    }
                  } else if (guessedSong && guessedSong.releaseYear) {
                    yearText = `${guessedSong.releaseYear}`;
                  }

                  return (
                    <div 
                      key={idx} 
                      className={`flex flex-col gap-2 px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all ${
                        isCorrect 
                          ? "bg-spotify/10 border-spotify/30 text-spotify" 
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
                      {!isSkipped && guessedSong && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {/* Artist badge */}
                          <div 
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase ${
                              matchesArtist 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                                : "bg-zinc-900/50 border-bento-border/40 text-zinc-500"
                            }`}
                            title={matchesArtist ? "Artist matches!" : "Wrong Artist"}
                          >
                            <User className="w-3 h-3" />
                            <span>{matchesArtist ? "Artist Match" : "Wrong Artist"}</span>
                          </div>

                          {/* Album badge */}
                          <div 
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase truncate max-w-[150px] ${
                              matchesAlbum 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                                : "bg-zinc-900/50 border-bento-border/40 text-zinc-500"
                            }`}
                            title={matchesAlbum ? "Album matches!" : "Wrong Album"}
                          >
                            <Disc className="w-3 h-3" />
                            <span>{matchesAlbum ? "Album Match" : "Wrong Album"}</span>
                          </div>

                          {/* Genre badge */}
                          <div 
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase truncate max-w-[150px] ${
                              matchesGenre 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                                : "bg-zinc-900/50 border-bento-border/40 text-zinc-500"
                            }`}
                            title={matchesGenre ? `Genre matches: ${guessedSong.genre}!` : `Wrong Genre: ${guessedSong.genre || "Unknown"}`}
                          >
                            <Tag className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {guessedSong.genre 
                                ? (matchesGenre ? `${guessedSong.genre} Match` : `${guessedSong.genre} (Wrong)`) 
                                : (matchesGenre ? "Genre Match" : "Wrong Genre")
                              }
                            </span>
                          </div>

                          {/* Release Year badge with arrows */}
                          <div 
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase ${yearBadgeColor}`}
                            title={
                              guessedSong.releaseYear === dailySong.releaseYear 
                                ? "Year matches!" 
                                : yearArrow === "🔼" 
                                  ? "Target is newer" 
                                  : "Target is older"
                            }
                          >
                            <Calendar className="w-3 h-3" />
                            <span>
                              {yearText} {yearArrow && <span className="ml-0.5 inline-block animate-bounce">{yearArrow}</span>}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Empty slots (future attempts)
                return (
                  <div 
                    key={idx} 
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-bento-border/50 bg-bento-bg/30 text-zinc-600 text-sm"
                  >
                    <span className="text-xs font-mono bg-bento-bg text-zinc-700 px-2 py-0.5 rounded-md border border-bento-border/50">
                      {idx + 1}
                    </span>
                    <span className="italic font-normal text-[11px] text-zinc-600">Pending attempt...</span>
                  </div>
                );
              })}
            </div>

            {/* If GameOver, Show primary Reveal Actions */}
            {gameOver && (
              <div className="mt-6 w-full flex flex-col gap-4 animate-fadeIn">
                <div className="bg-bento-bg border border-bento-border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full">
                    <img 
                      src={dailySong.artworkUrl} 
                      alt={dailySong.title} 
                      className="w-16 h-16 rounded-xl object-cover border border-bento-border shadow-lg flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase mb-1 ${hasWon ? "bg-spotify/20 text-spotify" : "bg-rose-500/20 text-rose-400"}`}>
                        {hasWon ? "CORRECT ANSWER" : "REVEALED ANSWER"}
                      </span>
                      <h4 className="text-base font-bold text-white truncate">{dailySong.title}</h4>
                      <p className="text-sm text-zinc-400 truncate mt-0.5">{dailySong.artist}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                      onClick={() => setShowResultsModal(true)}
                      className="flex-1 md:flex-none bg-spotify text-black hover:bg-spotify-hover px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-spotify/10 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer font-display"
                    >
                      <Award className="w-4 h-4" /> View Stats
                    </button>
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
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-bento-border flex items-center justify-center">
                  <Calendar className="text-spotify w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-mono tracking-wide uppercase">CHALLENGE CYCLE</p>
                  <p className="text-sm font-semibold text-white mt-0.5 font-display">
                    Daily Songle Routine
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 bg-spotify/10 text-spotify px-3 py-1.5 rounded-xl border border-spotify/20">
                <TrendingUp className="w-4 h-4 animate-bounce" />
                <span className="text-[11px] font-mono font-bold">STREAK: {stats.streak}</span>
              </div>
            </div>
            
            <div className="mt-5 pt-4 border-t border-bento-border/60">
              <p className="text-xs text-zinc-400 font-mono">CURRENT TIME COORDINATES</p>
              <p className="text-sm text-zinc-200 mt-1 font-semibold font-display">
                {new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1 font-mono">Auto-refreshed daily at UTC 00:00</p>
            </div>
          </div>

          {/* Subcard 2: Cumulative Dashboard Stats Widget */}
          <div className="bg-bento-card border border-bento-border rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-4 border-b border-bento-border/50 pb-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-bento-border flex items-center justify-center">
                <Activity className="text-spotify w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">My Stats</h4>
            </div>

            <div className="space-y-4">
              {/* Accumulative Metrics Row */}
              <div className="grid grid-cols-4 gap-1.5 w-full">
                <div className="bg-zinc-950/60 p-2 rounded-xl border border-bento-border text-center">
                  <p className="text-[8px] text-zinc-500 font-mono uppercase font-bold">Played</p>
                  <p className="text-sm font-bold text-white mt-0.5 font-display">{stats.played}</p>
                </div>
                <div className="bg-zinc-950/60 p-2 rounded-xl border border-bento-border text-center">
                  <p className="text-[8px] text-zinc-500 font-mono uppercase font-bold">Win rate</p>
                  <p className="text-sm font-bold text-spotify mt-0.5 font-display">
                    {stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0}%
                  </p>
                </div>
                <div className="bg-zinc-950/60 p-2 rounded-xl border border-bento-border text-center">
                  <p className="text-[8px] text-zinc-500 font-mono uppercase font-bold">Streak</p>
                  <p className="text-sm font-bold text-amber-500 mt-0.5 font-display">{stats.streak}</p>
                </div>
                <div className="bg-zinc-950/60 p-2 rounded-xl border border-bento-border text-center">
                  <p className="text-[8px] text-zinc-500 font-mono uppercase font-bold">Max</p>
                  <p className="text-sm font-bold text-indigo-400 mt-0.5 font-display">{stats.maxStreak}</p>
                </div>
              </div>

              {/* Distribution chart inline */}
              <div className="text-left bg-zinc-950/40 p-3.5 rounded-2xl border border-bento-border/60">
                <p className="text-[9px] text-zinc-400 font-mono uppercase mb-2.5 tracking-wide font-bold">GUESS TIMELINE HISTOGRAM</p>
                <div className="flex flex-col gap-1.5">
                  {stats.distribution.map((val, idx) => {
                    const max = Math.max(...stats.distribution, 1);
                    const widthPercent = (val / max) * 100;
                    const isCurrentAttempt = guesses.length === idx + 1 && hasWon;

                    return (
                      <div key={idx} className="flex items-center text-xs">
                        <span className="w-3 font-mono text-zinc-500 mr-2 text-[9px]">{idx + 1}</span>
                        <div className="flex-1 bg-zinc-950 h-4 rounded-lg overflow-hidden relative border border-bento-border/30">
                          {widthPercent > 0 && (
                            <div 
                              style={{ width: `${widthPercent}%` }} 
                              className={`h-full flex items-center justify-end px-2 text-[8px] font-mono font-bold transition-all ${
                                isCurrentAttempt ? "bg-spotify text-black" : "bg-zinc-800 text-zinc-300"
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
          </div>

          {/* Subcard 3: Global Leaderboard Widget */}
          <div className="bg-bento-card border border-bento-border rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col min-h-[360px]">
            <div className="flex justify-between items-center mb-4 border-b border-bento-border/50 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-bento-border flex items-center justify-center">
                  <Trophy className="text-amber-500 w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Global Leaderboard</h4>
              </div>

              <button 
                onClick={loadLeaderboardData}
                className="text-[9px] font-mono text-zinc-500 hover:text-spotify underline transition cursor-pointer font-bold uppercase border-none bg-transparent"
              >
                Refresh
              </button>
            </div>

            <div className="flex-1 flex flex-col justify-between">
              {isLeaderboardLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-2">
                  <div className="w-6 h-6 border-2 border-spotify border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-mono text-zinc-500">Querying global scores...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-1">
                  <Users className="w-8 h-8 text-zinc-600" />
                  <p className="text-xs font-semibold text-zinc-400">Leaderboard is empty</p>
                  <p className="text-[10px] font-mono text-zinc-500">Be the first to submit a high score!</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent">
                  {leaderboard.map((entry, idx) => {
                    const isSelf = userProfile?.uid === entry.uid;
                    let rankBadge = "text-zinc-400 font-mono";
                    if (idx === 0) rankBadge = "text-amber-400 font-bold";
                    else if (idx === 1) rankBadge = "text-zinc-300 font-bold";
                    else if (idx === 2) rankBadge = "text-amber-700 font-bold";

                    return (
                      <div 
                        key={entry.uid}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs transition ${
                          isSelf 
                            ? "bg-spotify/5 border-spotify/30 text-spotify" 
                            : "bg-zinc-950/40 border-bento-border/40 text-zinc-300"
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
                            <div className="flex items-center gap-0.5 text-orange-400 text-[10px] font-mono font-bold" title={`${entry.streak} Day streak`}>
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
                <div className="mt-3 bg-zinc-950/60 p-2.5 rounded-xl border border-bento-border text-center">
                  <button 
                    onClick={onOpenAuth}
                    className="text-[10px] text-spotify font-mono font-bold hover:underline cursor-pointer uppercase tracking-wider border-none bg-transparent"
                  >
                    Sign in to claim your leaderboard spot!
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
                
                <h3 className="text-xl font-bold font-display">
                  {hasWon ? "Splendid! You guessed it!" : "Good effort! Try again tomorrow"}
                </h3>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  {hasWon ? `SCORE: ${(6 - guesses.length) * 100 + speedBonus} points` : "Better luck next time"}
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
                    <p className="text-[10px] text-zinc-500 font-mono">SONG OF THE DAY</p>
                    <p className="font-bold text-white truncate text-base mt-0.5">{dailySong.title}</p>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{dailySong.artist} • <span className="italic text-zinc-500">{dailySong.album}</span></p>
                  </div>
                </div>

                {/* Score Emoji grid representation */}
                <div className="bg-bento-bg border border-bento-border p-4 rounded-2xl w-full mb-6">
                  <p className="text-[10px] text-zinc-400 font-mono mb-2.5 uppercase tracking-wide">GUESS TIMELINE</p>
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
                <div className="grid grid-cols-4 gap-2 w-full mb-6">
                  <div className="bg-bento-bg p-3 rounded-2xl border border-bento-border text-center">
                    <p className="text-[9px] text-zinc-500 font-mono uppercase">Played</p>
                    <p className="text-base font-bold text-white mt-1 font-display">{stats.played}</p>
                  </div>
                  <div className="bg-bento-bg p-3 rounded-2xl border border-bento-border text-center">
                    <p className="text-[9px] text-zinc-500 font-mono uppercase">Win %</p>
                    <p className="text-base font-bold text-spotify mt-1 font-display">
                      {stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0}%
                    </p>
                  </div>
                  <div className="bg-bento-bg p-3 rounded-2xl border border-bento-border text-center">
                    <p className="text-[9px] text-zinc-500 font-mono uppercase">Streak</p>
                    <p className="text-base font-bold text-amber-500 mt-1 font-display">{stats.streak}</p>
                  </div>
                  <div className="bg-bento-bg p-3 rounded-2xl border border-bento-border text-center">
                    <p className="text-[9px] text-zinc-500 font-mono uppercase">Max Streak</p>
                    <p className="text-base font-bold text-indigo-400 mt-1 font-display">{stats.maxStreak}</p>
                  </div>
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
                  <p className="text-xs text-spotify font-mono mt-3 animate-bounce">{copiedText}</p>
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

              <h3 className="text-lg font-bold flex items-center gap-2 text-white mb-4 font-display">
                <Sparkles className="text-spotify w-5 h-5 animate-pulse" /> Songle Help & Clues
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
                      Songle is the daily music discovery challenge. Guess the "Song of the Day" using progressively longer audio preview snippets.
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
                      Type artist or title names in the search bar. The autocomplete search queries the real <strong>iTunes API</strong> to guarantee correctly-formatted music entities!
                    </p>
                    <p>
                      Succeeded guesses or skips unlock the next tier duration. Try to identify the song in the fewest attempts to maximize your <strong>Daily Score & Streak</strong>!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-400">
                      Clues unlock dynamically as you submit guesses. The more you guess, the more details are revealed to narrow down your search!
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
                          <Unlock className="w-3.5 h-3.5 text-emerald-400 animate-bounce flex-shrink-0" />
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
                Let's Play!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

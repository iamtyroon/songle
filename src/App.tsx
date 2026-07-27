import React, { useState, useEffect } from "react";
import { HelpCircle, LogIn, Flame } from "lucide-react";
import { motion, MotionConfig } from "motion/react";
import SongleGame from "./components/SongleGame";
import AuthModal from "./components/AuthModal";
import AccountSettingsModal from "./components/AccountSettingsModal";
import { auth, db, logoutUser, syncUserProfile, UserProfile } from "./lib/firebase";
import logoUrl from "../logo.svg";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function App() {
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthLoading(true);
      if (firebaseUser) {
        try {
          const profile = await syncUserProfile(firebaseUser);
          setUserProfile(profile);
        } catch (e) {
          console.error("Error syncing profile on auth change", e);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Reload user profile stats (e.g. after submitting a score)
  const reloadProfile = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserProfile({
            uid: currentUser.uid,
            displayName: data.displayName,
            email: currentUser.email,
            photoURL: data.photoURL,
            providerId: currentUser.providerData[0]?.providerId || "anonymous",
            createdAt: data.createdAt,
            stats: data.stats,
            loginStreak: data.loginStreak,
            lastLoginDate: data.lastLoginDate
          } as UserProfile);
        }
      } catch (e) {
        console.error("Failed to reload user profile from Firestore, using local fallback", e);
        // Fallback to local storage if getDoc failed
        const savedStats = localStorage.getItem("songle_stats");
        if (savedStats && userProfile) {
          try {
            const parsedStats = JSON.parse(savedStats);
            setUserProfile({
              ...userProfile,
              stats: parsedStats
            });
          } catch (err) {
            console.error("Failed to parse local stats during reload fallback", err);
          }
        }
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setUserProfile(null);
      setShowSettingsModal(false);
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-bento-bg text-zinc-100 flex flex-col font-sans selection:bg-spotify/30 selection:text-spotify antialiased relative overflow-x-hidden">
      
      {/* Subtle grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f24_1px,transparent_1px),linear-gradient(to_bottom,#1f1f24_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.25] pointer-events-none z-0" />

      {/* Visual background ambient grids & blurs */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-spotify/5 via-bento-bg to-transparent pointer-events-none z-0" />
      <div className="absolute top-[-100px] left-1/4 w-[300px] h-[300px] bg-spotify/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[200px] right-1/4 w-[400px] h-[400px] bg-zinc-800/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Main Header navigation */}
      <header className="sticky top-0 z-40 bg-bento-bg/85 backdrop-blur-md border-b border-bento-border/70 py-4 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & title branding */}
          <div className="flex items-center gap-3.5">
            <img
              src={logoUrl}
              alt=""
              width={40}
              height={40}
              className="w-10 h-10 rounded-[9px] shadow-lg shadow-spotify/20"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-display">
                  SONGLE
                </h1>
              </div>
              <p className="text-xs text-zinc-400 font-mono">Name the song. Start with one second.</p>
            </div>
          </div>

          {/* Actions & Auth status button */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowHowToPlay(true)}
              className="text-zinc-400 hover:text-white bg-bento-card hover:bg-zinc-900 px-4 py-2.5 rounded-xl border border-bento-border transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-spotify" /> How to Play
            </button>

            {isAuthLoading ? (
              <div className="bg-bento-card border border-bento-border/80 h-10 w-24 rounded-xl flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-spotify border-t-transparent rounded-full animate-spin" />
              </div>
            ) : userProfile ? (
              // Logged in user profile chip
              <button
                onClick={() => setShowSettingsModal(true)}
                className="bg-bento-card border border-bento-border hover:bg-zinc-900 px-3.5 py-1.5 rounded-xl transition flex items-center gap-2.5 text-xs font-semibold cursor-pointer text-white"
              >
                <img 
                  src={userProfile.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(userProfile.displayName)}`} 
                  alt={userProfile.displayName} 
                  className="w-6.5 h-6.5 rounded-full border border-bento-border bg-bento-bg object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="text-left hidden xs:block">
                  <p className="font-bold truncate max-w-28 leading-tight">{userProfile.displayName}</p>
                  <p className="text-[9px] text-spotify font-mono font-semibold tracking-wide">{(userProfile.stats?.points) || 0} PTS</p>
                </div>
                {userProfile.loginStreak !== undefined && userProfile.loginStreak > 0 && (
                  <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-lg text-orange-500 text-[10px] font-mono font-bold">
                    <Flame className="w-3.5 h-3.5 fill-current" />
                    <span>{userProfile.loginStreak}</span>
                  </div>
                )}
              </button>
            ) : (
              // Sign In Trigger Button
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-spotify text-black hover:bg-spotify-hover px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-spotify/15 flex items-center gap-1.5 cursor-pointer font-display animate-none"
              >
                <LogIn className="w-4 h-4 text-black fill-current" /> Sign In
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 z-10 relative">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <SongleGame 
            userProfile={userProfile} 
            onScoreSubmitted={reloadProfile}
            onOpenAuth={() => setShowAuthModal(true)}
            showHowToPlay={showHowToPlay}
            onOpenHowToPlay={() => setShowHowToPlay(true)}
            onCloseHowToPlay={() => setShowHowToPlay(false)}
          />
        </motion.div>
      </main>

      {/* Modals & Popups */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(profile) => setUserProfile(profile)}
      />

      <AccountSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        userProfile={userProfile}
        onProfileUpdate={(updated) => setUserProfile(updated)}
        onLogout={handleLogout}
      />

      {/* Global Footer */}
      <footer className="mt-auto py-8 border-t border-bento-border bg-bento-bg text-zinc-500 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div>
            <p className="text-zinc-400 font-bold flex items-center gap-2 justify-center sm:justify-start">
              <img src={logoUrl} alt="" width={16} height={16} className="w-4 h-4 rounded-[3.5px]" /> SONGLE
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">One song a day. Six guesses. Six seconds of rope.</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-zinc-500">
            <span>Powered by iTunes Search API</span>
          </div>
        </div>
      </footer>

    </div>
    </MotionConfig>
  );
}

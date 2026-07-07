import React, { useState } from "react";
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Sparkles, 
  Github, 
  LogOut, 
  AlertCircle,
  HelpCircle,
  CheckCircle,
  Link2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  signInWithGoogle, 
  signInWithTwitter, 
  signInWithGithub, 
  signInGuest, 
  registerWithEmail, 
  loginWithEmail 
} from "../lib/firebase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (userProfile: any) => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setError(null);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email || !password) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    if (activeTab === "register" && !name) {
      setError("Please specify a nickname.");
      setIsLoading(false);
      return;
    }

    try {
      let profile;
      if (activeTab === "login") {
        profile = await loginWithEmail(email, password);
        setSuccessMsg("Logged in successfully!");
      } else {
        profile = await registerWithEmail(email, password, name);
        setSuccessMsg("Account registered successfully!");
      }

      setTimeout(() => {
        onAuthSuccess(profile);
        onClose();
        resetForm();
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already in use.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("Invalid email or password combination.");
      } else if (err.code === "auth/user-not-found") {
        setError("No user found with this email.");
      } else {
        setError(err.message || "An authentication error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderAuth = async (providerFn: () => Promise<any>, providerName: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const profile = await providerFn();
      setSuccessMsg(`Logged in via ${providerName}!`);
      setTimeout(() => {
        onAuthSuccess(profile);
        onClose();
        resetForm();
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to sign in via ${providerName}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestPlay = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const profile = await signInGuest();
      setSuccessMsg("Welcome! Logging in as Guest...");
      setTimeout(() => {
        onAuthSuccess(profile);
        onClose();
        resetForm();
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError("Failed to start guest session. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bento-bg/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="bg-bento-card border border-bento-border rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative text-white"
        >
          {/* Header Bar */}
          <div className="px-6 pt-6 pb-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-spotify/15 flex items-center justify-center text-spotify">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-bold text-lg font-display tracking-tight text-white">
                {activeTab === "login" ? "Sign In to Songle" : "Join Songle Team"}
              </h3>
            </div>
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 p-2 rounded-full border border-bento-border/80 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 pb-6 pt-2">
            <p className="text-xs text-zinc-400 font-mono mb-4 leading-relaxed">
              Track your daily music streaks, submit scores to the real-time leaderboard, and compete globally!
            </p>

            {/* Error & Success Messages */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 mb-4 font-mono"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-spotify/10 border border-spotify/20 text-spotify px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 mb-4 font-mono"
              >
                <CheckCircle className="w-4 h-4 text-spotify flex-shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            {/* Main Tabs Selection */}
            <div className="flex bg-zinc-950 p-1 rounded-2xl border border-bento-border mb-4 gap-1">
              <button
                onClick={() => { setActiveTab("login"); setError(null); }}
                className={`flex-1 text-center py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer font-display ${
                  activeTab === "login" 
                    ? "bg-zinc-900 text-spotify border border-bento-border/40 font-bold" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Login Account
              </button>
              <button
                onClick={() => { setActiveTab("register"); setError(null); }}
                className={`flex-1 text-center py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer font-display ${
                  activeTab === "register" 
                    ? "bg-zinc-900 text-spotify border border-bento-border/40 font-bold" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Quick Register
              </button>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3.5 mb-5">
              {activeTab === "register" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">Nickname</label>
                  <div className="flex items-center bg-zinc-950 border border-bento-border/60 rounded-xl px-3 py-2.5 focus-within:border-spotify/80 transition-all">
                    <User className="text-zinc-500 w-4.5 h-4.5 mr-2" />
                    <input
                      type="text"
                      placeholder="e.g. SynthWave_07"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-transparent border-none text-white focus:outline-none w-full text-xs"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">Email Address</label>
                <div className="flex items-center bg-zinc-950 border border-bento-border/60 rounded-xl px-3 py-2.5 focus-within:border-spotify/80 transition-all">
                  <Mail className="text-zinc-500 w-4.5 h-4.5 mr-2" />
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-transparent border-none text-white focus:outline-none w-full text-xs"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">Password</label>
                <div className="flex items-center bg-zinc-950 border border-bento-border/60 rounded-xl px-3 py-2.5 focus-within:border-spotify/80 transition-all">
                  <Lock className="text-zinc-500 w-4.5 h-4.5 mr-2" />
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-transparent border-none text-white focus:outline-none w-full text-xs"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-spotify text-black hover:bg-spotify-hover py-3 rounded-xl font-bold text-xs transition-all shadow-md shadow-spotify/10 flex items-center justify-center gap-1.5 cursor-pointer font-display disabled:opacity-40"
              >
                {isLoading ? (
                  <div className="w-4.5 h-4.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : activeTab === "login" ? (
                  "Log In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            {/* Separator */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-bento-border/40"></div>
              <span className="flex-shrink mx-4 text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Or Connect with Social</span>
              <div className="flex-grow border-t border-bento-border/40"></div>
            </div>

            {/* Social Auth Providers Grid */}
            <div className="grid grid-cols-3 gap-2 mt-3.5">
              <button
                onClick={() => handleProviderAuth(signInWithGoogle, "Google")}
                disabled={isLoading}
                className="bg-zinc-950 hover:bg-zinc-900 border border-bento-border text-xs py-3.5 px-2.5 rounded-xl font-bold flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:border-spotify/40 disabled:opacity-30"
                title="Sign in with Google"
              >
                <svg className="w-5 h-5 text-zinc-300" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.984 0-.74-.078-1.3-.173-1.86H12.24z"
                  />
                </svg>
                <span className="text-[10px] text-zinc-400 font-mono tracking-wide">Google</span>
              </button>

              <button
                onClick={() => handleProviderAuth(signInWithTwitter, "Twitter")}
                disabled={isLoading}
                className="bg-zinc-950 hover:bg-zinc-900 border border-bento-border text-xs py-3.5 px-2.5 rounded-xl font-bold flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:border-spotify/40 disabled:opacity-30"
                title="Sign in with X / Twitter"
              >
                {/* Custom X Logo */}
                <svg className="w-5 h-5 text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className="text-[10px] text-zinc-400 font-mono tracking-wide">X / Twitter</span>
              </button>

              <button
                onClick={() => handleProviderAuth(signInWithGithub, "GitHub")}
                disabled={isLoading}
                className="bg-zinc-950 hover:bg-zinc-900 border border-bento-border text-xs py-3.5 px-2.5 rounded-xl font-bold flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:border-spotify/40 disabled:opacity-30"
                title="Sign in with GitHub"
              >
                <Github className="w-5 h-5 text-zinc-300" />
                <span className="text-[10px] text-zinc-400 font-mono tracking-wide">GitHub</span>
              </button>
            </div>

            {/* Guest Entry Option */}
            <div className="mt-5 text-center">
              <span className="text-zinc-500 text-xs">Don't want an account? </span>
              <button 
                onClick={handleGuestPlay}
                disabled={isLoading}
                className="text-spotify hover:text-spotify-hover text-xs font-bold underline ml-1 cursor-pointer"
              >
                Instant Guest Session
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

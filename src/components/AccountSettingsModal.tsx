import React, { useState, useEffect } from "react";
import { 
  X, 
  User, 
  Settings, 
  LogOut, 
  Check,
  AlertCircle,
  Mail,
  Lock,
  Link2,
  Flame,
  Trash2,
  KeyRound,
  ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  auth, 
  db, 
  updateUserProfile, 
  UserProfile, 
  updateUserEmail, 
  updateUserPassword, 
  deleteUserAccount 
} from "../lib/firebase";
import { effectiveStreak } from "../lib/streak";
import { doc, updateDoc } from "firebase/firestore";
import { linkWithCredential, EmailAuthProvider } from "firebase/auth";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onProfileUpdate: (updatedProfile: UserProfile) => void;
  onLogout: () => void;
}

const AVATAR_PRESETS = [
  "Aditya", "Leo", "Buster", "Lucky", "Simba", 
  "Milo", "Coco", "Shadow", "Sasha", "Gizmo",
  "Peanut", "Zoe", "Oliver", "Bella", "Max"
];

export default function AccountSettingsModal({ 
  isOpen, 
  onClose, 
  userProfile, 
  onProfileUpdate, 
  onLogout 
}: AccountSettingsModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // For upgrading guest account
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [isUpgrading, setIsUpgrading] = useState(false);

  // For updating email
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // For updating password
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // For account deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || "");
      setSelectedAvatar(userProfile.photoURL || "");
    }
  }, [userProfile, isOpen]);

  if (!isOpen || !userProfile) return null;

  const winStreak = effectiveStreak(
    userProfile.stats?.streak,
    userProfile.stats?.lastPlayedDate
  );

  const currentAvatarSeed = (avatarUrl: string) => {
    if (!avatarUrl) return "";
    try {
      const url = new URL(avatarUrl);
      return url.searchParams.get("seed") || "";
    } catch {
      return "";
    }
  };

  const handleAvatarSelect = (seed: string) => {
    const newUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
    setSelectedAvatar(newUrl);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUpdating(true);

    if (!displayName.trim()) {
      setErrorMsg("Display name cannot be empty.");
      setIsUpdating(false);
      return;
    }

    try {
      await updateUserProfile(displayName.trim(), selectedAvatar);
      
      const updated: UserProfile = {
        ...userProfile,
        displayName: displayName.trim(),
        photoURL: selectedAvatar
      };
      
      onProfileUpdate(updated);
      setSuccessMsg("Profile details updated successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to update profile.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpgradeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUpgrading(true);

    if (!upgradeEmail || !upgradePassword) {
      setErrorMsg("Please provide both email and password.");
      setIsUpgrading(false);
      return;
    }

    if (upgradePassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      setIsUpgrading(false);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setErrorMsg("No active guest session found.");
      setIsUpgrading(false);
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(upgradeEmail, upgradePassword);
      const linkResult = await linkWithCredential(currentUser, credential);
      
      // Sync profile details now that account is linked
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        email: upgradeEmail,
        providerId: "password"
      });

      const updatedProfile: UserProfile = {
        ...userProfile,
        email: upgradeEmail,
        providerId: "password"
      };

      onProfileUpdate(updatedProfile);
      setSuccessMsg("Account upgraded successfully! Guest stats have been preserved.");
      setShowUpgradeForm(false);
      setUpgradeEmail("");
      setUpgradePassword("");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setErrorMsg("This email is already linked to another account.");
      } else {
        setErrorMsg(err.message || "Failed to link and upgrade account.");
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUpdatingEmail(true);

    if (!newEmail.trim()) {
      setErrorMsg("New email address cannot be empty.");
      setIsUpdatingEmail(false);
      return;
    }

    if (userProfile.providerId === "password" && !emailPassword) {
      setErrorMsg("Please specify your current password to authenticate this action.");
      setIsUpdatingEmail(false);
      return;
    }

    try {
      await updateUserEmail(newEmail.trim(), emailPassword || undefined);
      setSuccessMsg("Email address updated successfully!");
      
      const updated: UserProfile = {
        ...userProfile,
        email: newEmail.trim()
      };
      
      onProfileUpdate(updated);
      setNewEmail("");
      setEmailPassword("");
      setShowEmailForm(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/wrong-password") {
        setErrorMsg("Incorrect current password specified.");
      } else if (err.code === "auth/email-already-in-use") {
        setErrorMsg("This email is already in use by another account.");
      } else if (err.code === "auth/requires-recent-login") {
        setErrorMsg("This action requires a recent login. Please log out and log back in, then try again.");
      } else {
        setErrorMsg(err.message || "Failed to update email address.");
      }
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUpdatingPassword(true);

    if (!newPassword || !confirmNewPassword) {
      setErrorMsg("Please fill in all password fields.");
      setIsUpdatingPassword(false);
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("New password must be at least 6 characters long.");
      setIsUpdatingPassword(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg("New passwords do not match.");
      setIsUpdatingPassword(false);
      return;
    }

    if (userProfile.providerId === "password" && !currentPassword) {
      setErrorMsg("Please specify your current password to authenticate this action.");
      setIsUpdatingPassword(false);
      return;
    }

    try {
      await updateUserPassword(newPassword, currentPassword || undefined);
      setSuccessMsg("Password changed successfully!");
      setNewPassword("");
      setConfirmNewPassword("");
      setCurrentPassword("");
      setShowPasswordForm(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/wrong-password") {
        setErrorMsg("Incorrect current password specified.");
      } else if (err.code === "auth/requires-recent-login") {
        setErrorMsg("This action requires a recent login. Please log out and log back in, then try again.");
      } else {
        setErrorMsg(err.message || "Failed to update password.");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsDeletingAccount(true);

    if (userProfile.providerId === "password" && !deletePassword) {
      setErrorMsg("Please specify your password to confirm deletion.");
      setIsDeletingAccount(false);
      return;
    }

    try {
      await deleteUserAccount(deletePassword || undefined);
      onLogout();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/wrong-password") {
        setErrorMsg("Incorrect password specified.");
      } else if (err.code === "auth/requires-recent-login") {
        setErrorMsg("Sensitive action requires a fresh login. Please sign out, sign in again, then proceed with deletion.");
      } else {
        setErrorMsg(err.message || "Failed to delete account. Try signing in again first.");
      }
      setIsDeletingAccount(false);
    }
  };

  const isGuest = userProfile.providerId === "anonymous";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bento-bg/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="bg-bento-card border border-bento-border rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative text-white scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
        >
          {/* Header Bar */}
          <div className="px-6 pt-6 pb-2 flex justify-between items-center border-b border-bento-border/40">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-spotify/15 flex items-center justify-center text-spotify">
                <Settings className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-bold text-lg font-display tracking-tight text-white">
                Account Settings
              </h3>
            </div>
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 p-2 rounded-full border border-bento-border/80 transition cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            
            {/* Quick Messages */}
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 font-mono"
              >
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 flex-shrink-0" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-spotify/10 border border-spotify/20 text-spotify px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 font-mono"
              >
                <Check className="w-4.5 h-4.5 text-spotify flex-shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            {/* Profile Summary Card with Stats */}
            <div className="bg-zinc-950 p-5 rounded-2xl border border-bento-border/60 flex flex-col md:flex-row items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-spotify/5 rounded-full blur-2xl pointer-events-none" />
              
              <img 
                src={selectedAvatar} 
                alt={displayName} 
                className="w-18 h-18 rounded-full border border-bento-border bg-bento-bg object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0 text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="text-[9px] font-mono font-bold tracking-widest bg-spotify/15 text-spotify px-2 py-0.5 rounded-full uppercase">
                    {userProfile.providerId === "anonymous" ? "Guest Account" : `${userProfile.providerId.replace(".com", "")} Member`}
                  </span>
                  {winStreak > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-mono font-bold bg-orange-500/15 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full">
                      <Flame className="w-3 h-3 fill-current" />
                      <span>{winStreak} DAY WIN STREAK</span>
                    </span>
                  )}
                </div>
                <h4 className="text-lg font-bold text-white truncate mt-1.5 font-display">{displayName}</h4>
                <p className="text-xs text-zinc-500 truncate font-mono mt-0.5">{userProfile.email || "No email linked"}</p>
              </div>

              {/* Points display */}
              <div className="bg-zinc-900 border border-bento-border/80 px-4 py-2 rounded-xl text-center">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">TOTAL POINTS</span>
                <p className="text-lg font-bold text-spotify font-display mt-0.5">{(userProfile.stats?.points) || 0}</p>
              </div>
            </div>

            {/* Guest Linking Alert Card */}
            {isGuest && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-white font-display">Upgrade to Permanent Account</h5>
                    <p className="text-[11px] text-zinc-400 mt-0.5 font-mono leading-relaxed">
                      You are logged in as a Guest. To protect your streak history, points, and leaderboard allocations from browser cache wipes, upgrade your account below!
                    </p>
                  </div>
                </div>

                {!showUpgradeForm ? (
                  <button
                    onClick={() => setShowUpgradeForm(true)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 px-3 rounded-xl text-xs font-display flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Link2 className="w-3.5 h-3.5" /> Link Email & Password
                  </button>
                ) : (
                  <form onSubmit={handleUpgradeAccount} className="space-y-3.5 pt-2 border-t border-bento-border/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-zinc-400 uppercase font-bold tracking-wider">Email</label>
                        <input
                          type="email"
                          placeholder="email@example.com"
                          value={upgradeEmail}
                          onChange={(e) => setUpgradeEmail(e.target.value)}
                          className="w-full bg-zinc-950 border border-bento-border/60 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500/80 text-white"
                          disabled={isUpgrading}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-zinc-400 uppercase font-bold tracking-wider">Password</label>
                        <input
                          type="password"
                          placeholder="Min 6 chars"
                          value={upgradePassword}
                          onChange={(e) => setUpgradePassword(e.target.value)}
                          className="w-full bg-zinc-950 border border-bento-border/60 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500/80 text-white"
                          disabled={isUpgrading}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowUpgradeForm(false)}
                        className="flex-1 bg-zinc-900 border border-bento-border text-white text-xs font-bold py-2 rounded-xl hover:bg-zinc-800 cursor-pointer"
                        disabled={isUpgrading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-amber-500 text-black text-xs font-bold py-2 rounded-xl hover:bg-amber-600 font-display flex items-center justify-center gap-1 cursor-pointer"
                        disabled={isUpgrading}
                      >
                        {isUpgrading ? "Linking..." : "Confirm Upgrade"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Profile Details Edit Form */}
            <div className="bg-zinc-950/40 p-4 border border-bento-border/40 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-bento-border/20 pb-2">
                <User className="w-4 h-4 text-spotify" /> Profile Settings
              </h4>
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">Display Nickname / Username</label>
                  <div className="flex items-center bg-zinc-950 border border-bento-border/60 rounded-xl px-3 py-2.5 focus-within:border-spotify/80 transition-all">
                    <User className="text-zinc-500 w-4.5 h-4.5 mr-2" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="bg-transparent border-none text-white focus:outline-none w-full text-xs"
                      disabled={isUpdating}
                    />
                  </div>
                </div>

                {/* Avatar Selector Presets */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider block">Choose Avatar Preset</label>
                  <div className="grid grid-cols-5 gap-2 bg-zinc-950 p-3.5 rounded-2xl border border-bento-border/50 max-h-40 overflow-y-auto">
                    {AVATAR_PRESETS.map((presetSeed) => {
                      const presetUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(presetSeed)}`;
                      const isSelected = selectedAvatar === presetUrl;
                      return (
                        <button
                          type="button"
                          key={presetSeed}
                          onClick={() => handleAvatarSelect(presetSeed)}
                          className={`relative rounded-xl overflow-hidden border p-0.5 aspect-square bg-zinc-900 transition flex items-center justify-center hover:scale-105 cursor-pointer ${
                            isSelected ? "border-spotify ring-1 ring-spotify bg-spotify/10" : "border-bento-border/80"
                          }`}
                          title={`Select seed ${presetSeed}`}
                        >
                          <img 
                            src={presetUrl} 
                            alt={presetSeed} 
                            className="w-10 h-10 object-cover"
                            referrerPolicy="no-referrer"
                          />
                          {isSelected && (
                            <div className="absolute bottom-0 right-0 bg-spotify text-black p-0.5 rounded-tl-lg">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="bg-spotify text-black hover:bg-spotify-hover font-bold py-2 px-5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer font-display disabled:opacity-50"
                    disabled={isUpdating}
                  >
                    {isUpdating ? "Saving..." : "Save Profile Details"}
                  </button>
                </div>
              </form>
            </div>

            {/* Account Credentials & Security Section */}
            {!isGuest && (
              <div className="bg-zinc-950/40 p-4 border border-bento-border/40 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-bento-border/20 pb-2">
                  <KeyRound className="w-4 h-4 text-spotify" /> Credentials & Security
                </h4>

                <div className="space-y-3.5">
                  {/* Email Settings Toggle */}
                  <div className="border-b border-bento-border/20 pb-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h5 className="text-xs font-bold text-white">Email Address</h5>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{userProfile.email || "No email address linked"}</p>
                      </div>
                      {userProfile.providerId === "password" && (
                        <button
                          onClick={() => {
                            setShowEmailForm(!showEmailForm);
                            setShowPasswordForm(false);
                            setShowDeleteConfirm(false);
                            setErrorMsg(null);
                          }}
                          className="bg-zinc-900 hover:bg-zinc-800 border border-bento-border/80 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono"
                        >
                          {showEmailForm ? "Cancel" : "Change Email"}
                        </button>
                      )}
                    </div>

                    {showEmailForm && (
                      <motion.form 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        onSubmit={handleUpdateEmail} 
                        className="space-y-3 mt-3.5 bg-zinc-950 p-3.5 rounded-xl border border-bento-border/50"
                      >
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-zinc-400 uppercase font-bold tracking-wider">New Email Address</label>
                          <div className="flex items-center bg-zinc-900 border border-bento-border/60 rounded-lg px-2.5 py-2">
                            <Mail className="text-zinc-500 w-4 h-4 mr-2" />
                            <input
                              type="email"
                              placeholder="new_email@example.com"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              className="bg-transparent border-none text-white focus:outline-none w-full text-xs"
                              disabled={isUpdatingEmail}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-zinc-400 uppercase font-bold tracking-wider">Current Password (Required)</label>
                          <div className="flex items-center bg-zinc-900 border border-bento-border/60 rounded-lg px-2.5 py-2">
                            <Lock className="text-zinc-500 w-4 h-4 mr-2" />
                            <input
                              type="password"
                              placeholder="Confirm current password"
                              value={emailPassword}
                              onChange={(e) => setEmailPassword(e.target.value)}
                              className="bg-transparent border-none text-white focus:outline-none w-full text-xs"
                              disabled={isUpdatingEmail}
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-spotify text-black hover:bg-spotify-hover font-bold py-2 rounded-lg text-xs transition cursor-pointer"
                          disabled={isUpdatingEmail}
                        >
                          {isUpdatingEmail ? "Updating Email..." : "Confirm Email Change"}
                        </button>
                      </motion.form>
                    )}
                  </div>

                  {/* Password Settings Toggle */}
                  <div className="pb-1">
                    <div className="flex justify-between items-center">
                      <div>
                        <h5 className="text-xs font-bold text-white">Password Settings</h5>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Keep your account secure by resetting or changing your password</p>
                      </div>
                      {userProfile.providerId === "password" && (
                        <button
                          onClick={() => {
                            setShowPasswordForm(!showPasswordForm);
                            setShowEmailForm(false);
                            setShowDeleteConfirm(false);
                            setErrorMsg(null);
                          }}
                          className="bg-zinc-900 hover:bg-zinc-800 border border-bento-border/80 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono"
                        >
                          {showPasswordForm ? "Cancel" : "Change Password"}
                        </button>
                      )}
                    </div>

                    {showPasswordForm && (
                      <motion.form 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        onSubmit={handleUpdatePassword} 
                        className="space-y-3 mt-3.5 bg-zinc-950 p-3.5 rounded-xl border border-bento-border/50"
                      >
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-zinc-400 uppercase font-bold tracking-wider">Current Password</label>
                          <div className="flex items-center bg-zinc-900 border border-bento-border/60 rounded-lg px-2.5 py-2">
                            <Lock className="text-zinc-500 w-4 h-4 mr-2" />
                            <input
                              type="password"
                              placeholder="Your current password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="bg-transparent border-none text-white focus:outline-none w-full text-xs"
                              disabled={isUpdatingPassword}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono text-zinc-400 uppercase font-bold tracking-wider">New Password</label>
                            <div className="flex items-center bg-zinc-900 border border-bento-border/60 rounded-lg px-2.5 py-2">
                              <Lock className="text-zinc-500 w-4 h-4 mr-2" />
                              <input
                                type="password"
                                placeholder="Min 6 characters"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="bg-transparent border-none text-white focus:outline-none w-full text-xs"
                                disabled={isUpdatingPassword}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono text-zinc-400 uppercase font-bold tracking-wider">Confirm Password</label>
                            <div className="flex items-center bg-zinc-900 border border-bento-border/60 rounded-lg px-2.5 py-2">
                              <Lock className="text-zinc-500 w-4 h-4 mr-2" />
                              <input
                                type="password"
                                placeholder="Confirm new password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                className="bg-transparent border-none text-white focus:outline-none w-full text-xs"
                                disabled={isUpdatingPassword}
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-spotify text-black hover:bg-spotify-hover font-bold py-2 rounded-lg text-xs transition cursor-pointer font-display"
                          disabled={isUpdatingPassword}
                        >
                          {isUpdatingPassword ? "Saving changes..." : "Confirm Password Change"}
                        </button>
                      </motion.form>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Advanced & Account Deletion Actions */}
            <div className="bg-rose-500/5 p-4 border border-rose-500/10 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold font-mono text-rose-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-rose-500/10 pb-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" /> Advanced Danger Actions
              </h4>

              <div className="flex justify-between items-center">
                <div>
                  <h5 className="text-xs font-bold text-white">Delete User Account</h5>
                  <p className="text-[10px] text-zinc-400 font-mono mt-0.5 leading-relaxed">
                    Permanently delete your profile, stats, points, and score histories. This is irreversible.
                  </p>
                </div>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setShowEmailForm(false);
                      setShowPasswordForm(false);
                      setErrorMsg(null);
                    }}
                    className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer font-mono"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword("");
                    }}
                    className="bg-zinc-900 hover:bg-zinc-800 border border-bento-border text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {showDeleteConfirm && (
                <motion.form 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleDeleteAccount} 
                  className="space-y-3.5 mt-3.5 bg-rose-500/5 p-3.5 rounded-xl border border-rose-500/20"
                >
                  <p className="text-[10px] font-mono text-rose-300 leading-relaxed">
                    Are you absolutely sure? This will instantly delete your account document on our servers. You will lose all your leaderboard statistics and cannot recover them.
                  </p>

                  {userProfile.providerId === "password" && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-rose-400 uppercase font-bold tracking-wider">Confirm Your Password</label>
                      <div className="flex items-center bg-zinc-950 border border-rose-500/30 rounded-lg px-2.5 py-2">
                        <Lock className="text-rose-400 w-4 h-4 mr-2" />
                        <input
                          type="password"
                          placeholder="Your account password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          className="bg-transparent border-none text-rose-100 focus:outline-none w-full text-xs"
                          disabled={isDeletingAccount}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-rose-500 text-white hover:bg-rose-600 font-bold py-2.5 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 font-display"
                    disabled={isDeletingAccount}
                  >
                    <Trash2 className="w-4 h-4" /> {isDeletingAccount ? "Deleting Account Data..." : "Confirm Permanent Account Deletion"}
                  </button>
                </motion.form>
              )}
            </div>

            {/* Logout Action Button */}
            <div className="flex justify-start pt-2 border-t border-bento-border/20">
              <button
                type="button"
                onClick={onLogout}
                className="bg-zinc-950 hover:bg-zinc-900 border border-rose-500/30 text-rose-300 font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

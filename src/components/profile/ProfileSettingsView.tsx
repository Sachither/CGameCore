"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, updateDoc, increment } from "firebase/firestore";
import { validate, sanitize } from "@/lib/validation-utils";
import { updateGameTagAction, cleanupDeletedUserAccountAction } from "@/app/actions/user-actions";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut, deleteUser, updateProfile } from "firebase/auth";
import { useToast } from "@/context/ToastContext";
import { DeleteAccountModal } from "./DeleteAccountModal";


export default function ProfileSettingsView() {
  const { profile, user, refreshProfile } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  
  // Form states initialized from profile
  const [username, setUsername] = useState("");
  const [codTag, setCodTag] = useState("");
  const [efootballTag, setEfootballTag] = useState("");
  const [showFineModal, setShowFineModal] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [pendingTagChange, setPendingTagChange] = useState<{ type: 'cod' | 'efootball', value: string } | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  // Guard: only initialize form from profile once to prevent
  // live Firestore snapshots from overwriting user input
  const isInitialized = useRef(false);

  // Synced from Auth (ONCE only)
  useEffect(() => {
    if (profile && !isInitialized.current) {
      isInitialized.current = true;
      setUsername(profile.username || "");
      setCodTag(profile.codTag || "");
      setEfootballTag(profile.efootballTag || "");
    }
  }, [profile]);

  // Avatar sprite sheet mapping (Standardized 4x5 grid = 20 avatars)
  const avatars = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (i % 4),
    y: Math.floor(i / 4),
  }));

  const handleTagChangeTrigger = async (type: 'cod' | 'efootball', value: string) => {
    if (!profile || !user) return;
    
    const sanitizedValue = sanitize(value);
    if (!sanitizedValue || sanitizedValue.length < 3) {
      toast.error("Tactical Error", "Invalid tag format (min 3 chars).");
      return;
    }

    const currentTag = type === 'cod' ? profile.codTag : profile.efootballTag;
    
    // If the tag is currently empty, update it for free!
    if (!currentTag) {
      try {
        setSaveLoading(true);
        const idToken = await user.getIdToken();
        const res = await updateGameTagAction(idToken, type, sanitizedValue);
        if (res.success) {
          toast.success("Identity Established", `Your ${type === 'cod' ? 'CODM' : 'eFootball'} ID has been registered.`);
        } else {
          toast.error("Target Refused", res.error || "Update failed.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Comms Failure", "Update could not be processed.");
      } finally {
        setSaveLoading(false);
      }
    } else {
      // If tag exists, require fine for change
      setPendingTagChange({ type, value: sanitizedValue });
      setShowFineModal(true);
    }
  };

  const confirmTagChange = async () => {
    if (!profile || !user || !pendingTagChange) return;
    
    // Check if user has enough coins (Client side check for early exit)
    if (profile.balanceCoins < 20) {
       toast.error("Funds Depleted", "Insufficient balance for tag change (20 Coins required).");
       setShowFineModal(false);
       return;
    }

    try {
      setSaveLoading(true);
      const idToken = await user.getIdToken();
      
      const sValue = sanitize(pendingTagChange.value);
      if (!sValue || sValue.length < 3) {
        toast.error("Tactical Error", "Invalid tag format.");
        setShowFineModal(false);
        return;
      }

      const res = await updateGameTagAction(idToken, pendingTagChange.type, sValue);
      
      if (res.success) {
        if (pendingTagChange.type === 'cod') setCodTag(sValue);
        if (pendingTagChange.type === 'efootball') setEfootballTag(sValue);
        toast.success("Identity Realignment", `20 Coins deducted for ${pendingTagChange.type === 'cod' ? 'CODM' : 'eFootball'} ID update.`);
      } else {
        toast.error("Target Refused", res.error || "Tactical update failed.");
      }

      setShowFineModal(false);
      setPendingTagChange(null);
    } catch (err: any) {
      console.error(err);
      toast.error("Comms Failure", "Could not reach authentication server.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAvatarChange = async (id: number) => {
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { avatarId: id });
      await refreshProfile();
      setIsAvatarModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAll = async () => {
    if (!user) return;
    const userErr = validate("USERNAME", username);
    if (userErr) {
      toast.error("Validation Error", userErr);
      setSaveLoading(false);
      return;
    }

    const sanitizedUsername = sanitize(username);
    const oldUsername = profile?.username?.toLowerCase();
    const newUsername = sanitizedUsername.toLowerCase();

    // Basic validation
    if (!sanitizedUsername || sanitizedUsername.trim().length === 0) {
      toast.error("Invalid Username", "Username cannot be empty.");
      return;
    }

    if (sanitizedUsername.length < 3) {
      toast.error("Invalid Username", "Username must be at least 3 characters long.");
      return;
    }

    console.log(`[Profile] Attempting to change username from "${oldUsername}" to "${newUsername}"`);

    try {
      setSaveLoading(true);

      // Unique Check if name changed
      if (oldUsername !== newUsername) {
        console.log(`[Profile] Username changed, checking availability for: ${newUsername}`);
        try {
          console.log(`[Profile] Making API call to /api/identity-check`);
          const availabilityRes = await fetch(
            `/api/identity-check?field=username&value=${encodeURIComponent(newUsername)}`
          );
          console.log(`[Profile] API response status: ${availabilityRes.status}`);
          const availabilityData = await availabilityRes.json();
          console.log(`[Profile] Full availability response:`, availabilityData);

          if (!availabilityData.success) {
            const errorMsg = availabilityData.error || "Could not verify username availability.";
            console.error(`[Profile] Availability check failed: ${errorMsg}`);
            toast.error("System Error", errorMsg);
            setSaveLoading(false);
            return;
          }

          if (!availabilityData.available) {
            console.log(`[Profile] Username ${newUsername} is NOT available - blocking change`);
            toast.error("Platform ID Conflict", "This username is already claimed by another operative.");
            setSaveLoading(false);
            return;
          }

          console.log(`[Profile] Username ${newUsername} is available - proceeding`);
          // Reserve new, delete old
          try {
            await setDoc(doc(db, "usernames", newUsername), { uid: user.uid });
            if (oldUsername) await deleteDoc(doc(db, "usernames", oldUsername));
            console.log(`[Profile] Successfully reserved username: ${newUsername}`);
          } catch (firestoreError: any) {
            console.error(`[Profile] Firestore reservation failed:`, firestoreError);
            toast.error("Reservation Failed", "Could not reserve the new username. Please try again.");
            setSaveLoading(false);
            return;
          }
        } catch (apiError: any) {
          console.error(`[Profile] API call failed:`, apiError);
          toast.error("System Error", "Could not verify username availability. Please try again.");
          setSaveLoading(false);
          return;
        }
      } else {
        console.log(`[Profile] Username unchanged: ${oldUsername}`);
      }

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        username: sanitizedUsername,
      });

      // Update Firebase Auth display name
      try {
        await updateProfile(user, {
          displayName: sanitizedUsername
        });
        console.log(`[Profile] Updated Firebase Auth display name to: ${sanitizedUsername}`);
      } catch (authError: any) {
        console.error(`[Profile] Firebase Auth update failed:`, authError);
        // Don't fail the whole operation for Auth update failure
      }

      await refreshProfile();
      toast.success("Profile Secured", "Account realignment successful.");
      console.log(`[Profile] Profile update completed successfully`);
    } catch (err) {
      console.error(err);
      toast.error("System Error", "Error saving profile.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (err) {
      console.error("Sign out failed:", err);
      toast.error("System Error", "Failed to sign out.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    
    try {
      // Note: If user hasn't logged in recently, Firebase requires re-authentication.
      // Usually "auth/requires-recent-login" is thrown.
      const idToken = await user.getIdToken();
      await cleanupDeletedUserAccountAction(idToken);
      await deleteUser(user);
      toast.success("Account Terminated", "Your account has been deleted and all data cleaned up.");
      setIsDeleteModalOpen(false);
      router.push('/');
    } catch (err: any) {
      console.error("Delete account failed:", err);
      if (err.code === 'auth/requires-recent-login') {
         toast.error("Security Lock", "Session too old. Please log out, log back in, and try again to verify your identity.");
      } else {
         toast.error("System Error", err.message || "Failed to delete account.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const avatarId = profile?.avatarId || 0;
  const avatarX = avatarId % 4;
  const avatarY = Math.floor(avatarId / 4);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pb-20 transition-colors duration-500">
      
      {/* Header */}
      <div className="w-full bg-surface border-b border-surface-border py-4 px-6 flex items-center justify-between sticky top-0 z-50">
         <Link href="/dashboard" className="text-sub hover:text-main transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest p-2 -ml-2 rounded-sm hover:bg-surface-hover">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
         </Link>
         
         <div className="text-[10px] text-sub font-bold uppercase tracking-[0.2em]">Account Hub</div>
      </div>

      <div className="w-full max-w-2xl px-6 pt-12 space-y-12">
        
        {/* Profile Card / Avatar Trigger */}
        <section className="bg-surface border border-surface-border p-8 rounded-sm shadow-xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 -mr-16 -mt-16 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors"></div>
           
           <div className="flex flex-col sm:flex-row items-center gap-8 relative z-10">
              <div 
                className="relative cursor-pointer group/avatar"
                onClick={() => setIsAvatarModalOpen(true)}
              >
                 <div className="w-32 h-32 rounded-[5px] bg-black border-2 border-accent flex items-center justify-center rotate-45 overflow-hidden shadow-[0_0_30px_rgba(0,255,102,0.2)] group-hover/avatar:scale-105 transition-transform duration-500">
                    <div 
                      className="w-[300%] h-[300%] -rotate-45"
                      style={{
                        backgroundImage: `url('/avatar_collection.png')`,
                        backgroundSize: '400% 500%',
                        backgroundPosition: `${avatarX * 33.33}% ${avatarY * 25}%`
                      }}
                    />
                 </div>
                 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity rotate-45 pointer-events-none">
                    <span className="text-[10px] font-black text-accent uppercase tracking-widest -rotate-45">Edit Avatar</span>
                 </div>
              </div>

              <div className="flex-1 text-center sm:text-left">
                 <h2 className="text-3xl font-black text-main italic uppercase tracking-tighter transition-colors">{profile?.username || "Player"}</h2>
                 <p className="text-xs text-accent-aware font-bold uppercase tracking-widest mt-1">Platform ID: #CG-{user?.uid.slice(0,6).toUpperCase()}</p>
                 
                 <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-surface-hover border border-surface-border p-3 rounded-sm transition-colors text-center">
                       <span className="text-[10px] text-sub uppercase font-bold tracking-widest block mb-1">Matches Won</span>
                       <span className="text-main font-mono font-bold text-lg">{profile?.totalWins || 0}</span>
                    </div>
                    <div className="bg-surface-hover border border-surface-border p-3 rounded-sm transition-colors text-center">
                       <span className="text-[10px] text-sub uppercase font-bold tracking-widest block mb-1">Total Prize</span>
                       <span className="text-accent-aware font-mono font-bold text-lg">${( (profile?.balanceCoins || 0) / 100).toFixed(2)} USD</span>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Form Identity */}
        <section className="space-y-6">
           <h3 className="text-xs font-black uppercase tracking-[0.2em] text-sub border-b border-surface-border pb-4 italic">User Identity</h3>
           
           <div className="space-y-6">
              <div>
                 <label className="text-[10px] uppercase font-bold text-sub tracking-widest block mb-2 ml-1">Platform Nickname</label>
                 <input 
                    type="text" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-surface-hover border border-surface-border focus:border-accent p-4 rounded-sm text-sm text-main outline-none transition-all font-bold"
                 />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-sub tracking-widest block ml-1 flex justify-between">
                       CODM ID <span className="text-red-500 text-[9px]">Fine applied</span>
                    </label>
                    <div className="relative group">
                       <input 
                          type="text" 
                          value={codTag} onChange={e => setCodTag(e.target.value)}
                          className="w-full bg-surface-hover border border-surface-border p-4 rounded-sm text-sm text-main outline-none font-bold focus:border-accent transition-all"
                       />
                       <button onClick={() => handleTagChangeTrigger('cod', codTag)} className="absolute right-4 top-1/2 -translate-y-1/2 text-accent text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Change</button>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-sub tracking-widest block ml-1 flex justify-between">
                       eFootball ID <span className="text-red-500 text-[9px]">Fine applied</span>
                    </label>
                    <div className="relative group">
                       <input 
                          type="text" 
                          value={efootballTag} onChange={e => setEfootballTag(e.target.value)}
                          className="w-full bg-surface-hover border border-surface-border p-4 rounded-sm text-sm text-main outline-none font-bold focus:border-accent transition-all"
                       />
                       <button onClick={() => handleTagChangeTrigger('efootball', efootballTag)} className="absolute right-4 top-1/2 -translate-y-1/2 text-accent text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Change</button>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Wallet Section */}
        <section className="space-y-6">
           <h3 className="text-xs font-black uppercase tracking-[0.2em] text-sub border-b border-surface-border pb-4 italic">Financial Management</h3>
           
           <div className="space-y-4">
              <Link href="/dashboard/wallet" className="bg-surface border border-surface-border p-6 rounded-sm flex items-center justify-between group hover:border-accent transition-all shadow-lg">
                 <div>
                    <h4 className="text-sm font-bold text-main uppercase tracking-widest group-hover:text-accent transition-colors mb-1">Withdrawal Bank Info</h4>
                    <span className="text-[9px] text-sub uppercase font-bold tracking-widest">Edit your payout destinations (KYC REQUIRED)</span>
                 </div>
                 <svg className="w-5 h-5 text-gray-600 group-hover:text-accent transition-all translate-x-0 group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
           </div>
        </section>

        {/* Save Area */}
        <div className="pt-6 border-t border-surface-border">
           <button 
            onClick={handleSaveAll}
            disabled={saveLoading}
            className="w-full bg-accent hover:bg-accent-hover text-black py-5 rounded-sm font-black uppercase tracking-[0.3em] italic shadow-[0_10px_40px_rgba(0,255,102,0.3)] transition-all hover:-translate-y-1 disabled:opacity-50"
           >
              {saveLoading ? "Saving..." : "Save All Changes"}
           </button>
        </div>

        {/* Danger Zone */}
        <section className="space-y-6 pt-12">
           <h3 className="text-xs font-black uppercase tracking-[0.2em] text-red-500/50 border-b border-red-500/10 pb-4 italic">Danger Zone</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleLogout} 
                className="flex-1 bg-surface border border-surface-border hover:border-white text-sub hover:text-main py-4 rounded-sm text-xs font-black uppercase tracking-widest transition-all"
              >
                Logout
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(true)} 
                className="flex-1 bg-red-500/5 border border-red-500/20 hover:border-red-500 text-red-500 py-4 rounded-sm text-xs font-black uppercase tracking-widest transition-all"
              >
                Delete Account
              </button>
           </div>
        </section>
      </div>

      {/* Avatar Selection Modal */}
      {isAvatarModalOpen && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="absolute inset-0 bg-black/90" onClick={() => setIsAvatarModalOpen(false)} />
            <div className="relative w-full max-w-md bg-surface border border-surface-border p-8 rounded-sm shadow-2xl">
               <h3 className="text-xl font-black text-main italic uppercase tracking-widest text-center mb-8">Select Premium Avatar</h3>
               <div className="grid grid-cols-4 gap-6 max-h-[60vh] overflow-y-auto px-2">
                  {avatars.map((avatar) => (
                    <button 
                      key={avatar.id}
                      onClick={() => handleAvatarChange(avatar.id)}
                      className={`aspect-square rounded-[3px] border-2 transition-all flex items-center justify-center rotate-45 overflow-hidden shadow-lg group shrink-0 ${profile?.avatarId === avatar.id ? 'border-accent p-0.5' : 'border-surface-border grayscale hover:grayscale-0 hover:border-white'}`}
                    >
                      <div 
                        className="w-[200%] h-[200%] -rotate-45"
                        style={{
                          backgroundImage: `url('/avatar_collection.png')`,
                          backgroundSize: '400% 500%',
                          backgroundPosition: `${(avatar.id % 4) * 33.33}% ${Math.floor(avatar.id / 4) * 25}%`
                        }}
                      />
                    </button>
                  ))}
               </div>
               <button 
                 onClick={() => setIsAvatarModalOpen(false)}
                 className="w-full mt-10 bg-transparent text-sub hover:text-main font-bold uppercase tracking-widest text-[10px] transition-colors"
               >
                 Close Selection
               </button>
            </div>
         </div>
      )}

      {/* Fine Modal */}
      {showFineModal && (
         <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-xl">
            <div className="absolute inset-0 bg-black/95" onClick={() => setShowFineModal(false)} />
            <div className="relative w-full max-w-sm bg-surface border border-red-500/30 p-10 rounded-sm shadow-2xl text-center">
               <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-8 animate-pulse">
                  <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               </div>
               <h3 className="text-2xl font-black text-main italic uppercase tracking-tighter mb-4">Identity Fine</h3>
               <p className="text-xs text-sub font-bold uppercase tracking-widest leading-relaxed mb-10">
                  Changing your gamer tag requires a <span className="text-red-500 underline">20 Coin fee</span> to prevent verification spoofing.
               </p>
               <div className="flex flex-col gap-4">
                  <button onClick={confirmTagChange} disabled={saveLoading} className="w-full bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest py-5 rounded-sm shadow-lg transition-all animate-bounce disabled:opacity-50">
                    {saveLoading ? "Processing..." : "Confirm & Deduct"}
                  </button>
                  <button onClick={() => setShowFineModal(false)} className="w-full text-sub hover:text-main font-bold uppercase tracking-widest text-[10px]">Cancel</button>
               </div>
            </div>
         </div>
      )}

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onConfirm={handleDeleteAccount}
        onCancel={() => setIsDeleteModalOpen(false)}
        isLoading={isDeleting}
      />

    </div>
  );
}

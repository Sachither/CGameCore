"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { validate, sanitize } from '@/lib/validation-utils';
import { useToast } from "@/context/ToastContext";
import GoogleLoginButton from "./GoogleLoginButton";
import { sendWelcomeEmailAction, registerUserAction } from '@/app/actions/user-actions';
import { useAuth } from './AuthProvider';

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isGoogleOnboarding = user && !profile;

  const [formData, setFormData] = useState({
    username: "",
    email: user?.email || "",
    phone: "",
    password: "GOOGLE_AUTH_PLACEHOLDER", // Not used for Google users
    confirmPassword: "GOOGLE_AUTH_PLACEHOLDER",
    referralCode: (typeof window !== 'undefined' ? localStorage.getItem('pending_referral_code') : "") || ""
  });

  // Sync email and username if Google onboarding starts
  React.useEffect(() => {
    if (isGoogleOnboarding) {
      setFormData(prev => ({ 
        ...prev, 
        email: prev.email || user?.email || "",
        username: prev.username || user?.displayName?.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '') || ""
      }));
    }
  }, [isGoogleOnboarding, user?.email, user?.displayName]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
       // Only allow digits and + prefix
       const sanitized = value.replace(/[^0-9+]/g, '');
       setFormData({ ...formData, [name]: sanitized });
    } else {
       setFormData({ ...formData, [name]: value });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent Enter from submitting the form
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const validateInput = () => {
    let err: string | null = null;
    
    err = validate("USERNAME", formData.username);
    if (err) { setError(err); return false; }
    
    if (!isGoogleOnboarding) {
       err = validate("EMAIL", formData.email);
       if (err) { setError(err); return false; }
       
       err = validate("PHONE", formData.phone);
       if (err) { setError(err); return false; }
       
       if (formData.password.length < 8) {
         setError("Password must be at least 8 characters.");
         return false;
       }
       
       if (formData.password !== formData.confirmPassword) {
         setError("Passwords do not match.");
         return false;
       }
    } else {
       // For Google users, only username and phone are required
       err = validate("PHONE", formData.phone);
       if (err) { setError(err); return false; }
    }

    return true;
  };

  const handleSubmit = async () => {
    setError("");

    if (!validateInput()) return;

    setLoading(true);

    try {
      const lowerUsername = formData.username.toLowerCase();
      const availabilityRes = await fetch(
        `/api/id-verify?field=username&value=${encodeURIComponent(lowerUsername)}`
      );

      if (!availabilityRes.ok) {
        const errorText = await availabilityRes.text();
        console.error("[IdentityCheck] API Failure:", availabilityRes.status, errorText);
        throw new Error(`Identity check failed (Status ${availabilityRes.status}). Please try again.`);
      }

      const availabilityData = await availabilityRes.json();
      
      if (!availabilityData.success) {
        throw new Error(availabilityData.error || "Unable to verify username availability.");
      }

      if (!availabilityData.available) {
        setError("IDENTITY ALREADY IN USE. CHOOSE A UNIQUE HANDLE.");
        setLoading(false);
        return;
      }

      // 0.5 Check Phone Availability
      const phoneAvailabilityRes = await fetch(
        `/api/id-verify?field=phone&value=${encodeURIComponent(formData.phone)}`
      );

      if (!phoneAvailabilityRes.ok) {
        const errorText = await phoneAvailabilityRes.text();
        console.error("[PhoneCheck] API Failure:", phoneAvailabilityRes.status, errorText);
        throw new Error(`Phone verification failed (Status ${phoneAvailabilityRes.status}).`);
      }

      const phoneData = await phoneAvailabilityRes.json();

      if (!phoneData.success) {
        throw new Error(phoneData.error || "Unable to verify phone availability.");
      }

      if (!phoneData.available) {
        setError("PHONE NUMBER ALREADY IN USE. EACH ACCOUNT REQUIRES A UNIQUE LINE.");
        setLoading(false);
        return;
      }

      let activeUser = user;

      if (!isGoogleOnboarding) {
         // 1. Create Auth User (Email/Password flow)
         setError("COMMUNICATING WITH FIREBASE...");
         const userCredential = await createUserWithEmailAndPassword(
           auth, 
           formData.email, 
           formData.password
         );
         activeUser = userCredential.user;
      }

      if (!activeUser) throw new Error("Authentication link severed. Please restart onboarding.");

      // 2. [AEGIS] Finalize Identity & Create Profile on Server
      setError("ESTABLISHING SECURE PROFILE...");
      const idToken = await activeUser.getIdToken();
      
      const registerRes = await registerUserAction(idToken, {
        username: formData.username,
        email: activeUser.email || formData.email,
        phone: formData.phone,
        referralCode: formData.referralCode
      });

      if (!registerRes.success) {
        throw new Error(registerRes.error || "Profile initialization failed.");
      }

      setError("SUCCESS! SYNCING SECURE SESSION...");
      
      // Cleanup Recruitment Data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pending_referral_code');
        localStorage.removeItem('pending_referral_uid');
      }

      // Explicit redirect to ensure immediate transition
      const callback = searchParams.get('callback');
      router.push(callback ? decodeURIComponent(callback) : '/dashboard');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/configuration-not-found') {
        setError("Firebase Error: Email/Password login is not enabled in your Firebase Console. Please enable it in the Authentication tab.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("IDENTITY ALREADY IN USE. CHOOSE A UNIQUE HANDLE.");
      } else {
        setError(err.message || "Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-surface border border-surface-border rounded-sm p-8 shadow-2xl relative overflow-hidden group">
      {/* Subtle background glow */}
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 blur-[60px] pointer-events-none rounded-full group-hover:bg-accent/15 transition-colors" />

      <div className="text-center mb-8 relative z-10">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-main">
          {isGoogleOnboarding ? "Finalize " : "Join "} 
          <span className="text-accent">{isGoogleOnboarding ? "Identity" : "The Ladder"}</span>
        </h1>
        <p className="text-sub mt-2 text-sm font-bold tracking-tight">
          {isGoogleOnboarding ? "Complete your operative profile to enter." : "Register to start backing your skills."}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500 text-red-500 text-[10px] p-3 rounded-sm font-black uppercase tracking-widest text-center animate-pulse">
          {error}
        </div>
      )}

      <form 
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        className="space-y-4 relative z-10"
        suppressHydrationWarning
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Username</label>
            <input 
              type="text" 
              name="username"
              required 
              value={formData.username}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              autoComplete="username"
              className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold text-xs"
              placeholder="GamerTag"
              suppressHydrationWarning
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Phone</label>
            <input 
              type="tel" 
              name="phone"
              required 
              maxLength={11}
              value={formData.phone}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              inputMode="tel"
              autoComplete="tel"
              className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
              placeholder="080..."
              suppressHydrationWarning
            />
          </div>
        </div>

        {!isGoogleOnboarding && (
          <>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Email Address</label>
              <input 
                type="email" 
                name="email"
                required 
                value={formData.email}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                data-form-type="other"
                className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
                placeholder="player@example.com"
                suppressHydrationWarning
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Password</label>
                <div className="relative">
                  <input 
                    type="password"
                    name="password"
                    required 
                    value={formData.password}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    data-form-type="other"
                    className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold text-xs"
                    placeholder="••••••••"
                    suppressHydrationWarning
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Confirm</label>
                <div className="relative">
                  <input 
                    type="password"
                    name="confirmPassword"
                    required 
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
                    placeholder="••••••••"
                    suppressHydrationWarning
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Referral Code (Optional)</label>
          <input 
            type="text" 
            name="referralCode"
            value={formData.referralCode}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck="false"
            className="w-full bg-surface-hover border border-surface-border focus:border-accent text-accent px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-700 font-black text-xs tracking-widest"
            placeholder="CREATOR_CODE"
            suppressHydrationWarning
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || !formData.username || !formData.phone || (!isGoogleOnboarding && (!formData.email || !formData.password || !formData.confirmPassword))}
          className="w-full bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-wider py-4 rounded-sm transition-all shadow-[0_0_15px_rgba(0,255,102,0.2)] hover:shadow-[0_0_25px_rgba(0,255,102,0.5)] mt-4 border-2 border-transparent disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed flex justify-center items-center italic"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
          ) : (
             isGoogleOnboarding ? "Finalize Identity" : "Enter The Lobby"
          )}
        </button>

        {!isGoogleOnboarding && (
          <>
            <div className="flex items-center gap-4 my-6">
              <div className="h-px bg-surface-border flex-1"></div>
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">OR</span>
              <div className="h-px bg-surface-border flex-1"></div>
            </div>

            <GoogleLoginButton text="Onboard with Google" />
          </>
        )}

      </form>

      <div className="mt-8 text-center text-sm text-sub relative z-10 font-bold uppercase tracking-widest text-[9px]">
        {isGoogleOnboarding ? (
          <button 
            onClick={async () => {
              await auth.signOut();
              window.location.href = "/";
            }}
            className="text-red-500 hover:text-red-400 transition-all underline"
          >
            Cancel & Sign Out
          </button>
        ) : (
          <>
            Already playing?{' '}
            <Link href="/login" className="text-accent hover:text-accent-hover transition-all underline">
              SignIn
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

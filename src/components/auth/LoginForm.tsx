"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { validate } from '@/lib/validation-utils';

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Progress handled by AuthProvider

  const handleEmailLogin = async () => {
    setError("");

    const emailErr = validate("EMAIL", email);
    if (emailErr) { setError(emailErr); return; }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      setError("LOGGING IN TO CORE...");
      await signInWithEmailAndPassword(auth, email, password);
      setError("SUCCESS! SYNCING PROFILE...");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/configuration-not-found') {
        setError("Firebase Error: Email/Password login is not enabled in your Firebase Console. Please enable it in the Authentication tab.");
      } else if (err.code === 'auth/user-disabled') {
        setError("THIS USER HAS BEEN BANNED.");
      } else {
        setError("Invalid email or password. Please try again.");
      }
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent Enter from submitting the form
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  return (
    <div className="w-full max-w-md bg-surface border border-surface-border rounded-sm p-8 shadow-2xl relative overflow-hidden group">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-accent/10 blur-[60px] pointer-events-none rounded-full group-hover:bg-accent/15 transition-colors" />

      <div className="text-center mb-8 relative z-10">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-main">
          Welcome <span className="text-accent">Back</span>
        </h1>
        <p className="text-sub mt-2 text-sm font-bold tracking-tight">Access your queues and Escrow payouts.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500 text-red-500 text-[10px] p-3 rounded-sm font-black uppercase tracking-widest text-center animate-pulse">
          {error}
        </div>
      )}

      <form 
        onSubmit={(e) => { e.preventDefault(); handleEmailLogin(); }}
        className="space-y-6 relative z-10"
        suppressHydrationWarning
      >
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Email Address</label>
          <input 
            type="email" 
            required 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            data-form-type="other"
            className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
            placeholder="player@example.com"
            suppressHydrationWarning
          />
        </div>

        <div>
           <div className="flex justify-between items-center mb-2">
             <label className="block text-[10px] font-bold uppercase tracking-wider text-sub ml-1">Password</label>
             <Link href="#" className="text-[10px] text-accent hover:text-accent-hover font-bold uppercase tracking-widest transition-colors">Forgot?</Link>
           </div>
           <div className="relative">
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="current-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-form-type="other"
              className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
              placeholder="••••••••"
              suppressHydrationWarning
            />
           </div>
        </div>

        <button 
          type="submit" 
          disabled={loading || !email || !password}
          className="w-full bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-wider py-4 rounded-sm transition-all shadow-[0_0_15px_rgba(0,255,102,0.2)] hover:shadow-[0_0_25px_rgba(0,255,102,0.5)] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed flex justify-center items-center italic"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
          ) : (
             "Enter Dashboard"
          )}
        </button>


      </form>

      <div className="mt-8 text-center text-sm text-sub relative z-10 font-bold uppercase tracking-widest text-[9px]">
        First day on the ladder?{' '}
        <Link href="/register" className="text-accent hover:text-accent-hover transition-all underline">
          Join Now
        </Link>
      </div>
    </div>
  );
}

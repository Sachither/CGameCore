"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { validate } from '@/lib/validation-utils';

export default function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");

  const handleResetRequest = async () => {
    setError("");
    setSuccess(false);

    const emailErr = validate("EMAIL", email);
    if (emailErr) {
      setError(emailErr);
      return;
    }

    setLoading(true);

    try {
      setError("DISPATCHING RESET COMMAND...");
      
      // We configure actionCodeSettings so that it redirects back to our reset page if supported by Firebase
      const actionCodeSettings = {
        url: window.location.origin + '/reset-password',
        handleCodeInApp: true,
      };

      await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
      setSuccess(true);
      setError("");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError("NO OPERATIVE ENLISTED WITH THIS EMAIL.");
      } else if (err.code === 'auth/invalid-email') {
        setError("INVALID EMAIL FORMAT.");
      } else {
        setError("FAILED TO DISPATCH RESET EMAIL. TRY AGAIN LATER.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
          Reset <span className="text-accent">Password</span>
        </h1>
        <p className="text-sub mt-2 text-sm font-bold tracking-tight">Request a secure link to realign your access.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500 text-red-500 text-[10px] p-3 rounded-sm font-black uppercase tracking-widest text-center animate-pulse">
          {error}
        </div>
      )}

      {success ? (
        <div className="space-y-6 relative z-10 text-center">
          <div className="bg-accent/10 border border-accent text-accent text-[10px] p-4 rounded-sm font-black uppercase tracking-widest leading-relaxed">
            COMMAND DISPATCHED! CHECK YOUR INBOX FOR THE SECURE RESET LINK.
          </div>
          <p className="text-xs text-sub font-bold leading-relaxed">
            If you do not see the email within a few minutes, check your spam or promotional folders.
          </p>
          <div className="pt-4">
            <Link 
              href="/login" 
              className="inline-block bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-wider py-4 px-8 rounded-sm transition-all shadow-[0_0_15px_rgba(0,255,102,0.2)] hover:shadow-[0_0_25px_rgba(0,255,102,0.5)] italic"
            >
              Return to Login
            </Link>
          </div>
        </div>
      ) : (
        <form 
          onSubmit={(e) => { e.preventDefault(); handleResetRequest(); }}
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
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
              placeholder="player@example.com"
              suppressHydrationWarning
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !email}
            className="w-full bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-wider py-4 rounded-sm transition-all shadow-[0_0_15px_rgba(0,255,102,0.2)] hover:shadow-[0_0_25px_rgba(0,255,102,0.5)] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed flex justify-center items-center italic"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
            ) : (
              "Send Reset Link"
            )}
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="h-px bg-surface-border flex-1"></div>
            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">OR</span>
            <div className="h-px bg-surface-border flex-1"></div>
          </div>

          <div className="text-center text-sm text-sub font-bold uppercase tracking-widest text-[9px]">
            Remembered your access keys?{' '}
            <Link href="/login" className="text-accent hover:text-accent-hover transition-all underline">
              Log In
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

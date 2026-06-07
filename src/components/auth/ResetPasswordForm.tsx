"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');

  const [verifying, setVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setVerificationError("INVALID OR EXPIRED ACCESS TOKEN. PLEASE INITIATE A NEW PASSWORD RESET.");
      setVerifying(false);
      return;
    }

    const verifyCode = async () => {
      try {
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(userEmail);
      } catch (err: any) {
        console.error(err);
        setVerificationError("THIS PASSWORD RESET LINK IS INVALID OR HAS EXPIRED. PLEASE REQUEST A NEW LINK.");
      } finally {
        setVerifying(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  const handleResetPassword = async () => {
    setError("");
    setSuccess(false);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!oobCode) {
      setError("Missing action token.");
      return;
    }

    setLoading(true);

    try {
      setError("UPDATING SECURE ACCESS KEYS...");
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
      setError("");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/weak-password') {
        setError("PASSWORD IS TOO WEAK. CHOOSE A STRONGER COMBINATION.");
      } else {
        setError("FAILED TO REALIGN PASSWORD. THE LINK MAY HAVE EXPIRED.");
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
          Realign <span className="text-accent">Access</span>
        </h1>
        <p className="text-sub mt-2 text-sm font-bold tracking-tight">Set your new account credentials.</p>
      </div>

      {verifying ? (
        <div className="flex flex-col items-center justify-center py-10 relative z-10 space-y-4">
          <span className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></span>
          <span className="text-[10px] font-black text-accent uppercase tracking-widest animate-pulse">VERIFYING TARGET SIGNAL...</span>
        </div>
      ) : verificationError ? (
        <div className="space-y-6 relative z-10 text-center">
          <div className="bg-red-500/10 border border-red-500 text-red-500 text-[10px] p-4 rounded-sm font-black uppercase tracking-widest leading-relaxed">
            {verificationError}
          </div>
          <div className="pt-4">
            <Link 
              href="/forgot-password" 
              className="inline-block bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-wider py-4 px-8 rounded-sm transition-all shadow-[0_0_15px_rgba(0,255,102,0.2)] hover:shadow-[0_0_25px_rgba(0,255,102,0.5)] italic"
            >
              Request New Link
            </Link>
          </div>
        </div>
      ) : success ? (
        <div className="space-y-6 relative z-10 text-center">
          <div className="bg-accent/10 border border-accent text-accent text-[10px] p-4 rounded-sm font-black uppercase tracking-widest leading-relaxed">
            SUCCESS! YOUR ACCESS KEYS HAVE BEEN REALIGNED.
          </div>
          <p className="text-xs text-sub font-bold leading-relaxed">
            You can now log in to the dashboard using your new password.
          </p>
          <div className="pt-4">
            <Link 
              href="/login" 
              className="inline-block bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-wider py-4 px-8 rounded-sm transition-all shadow-[0_0_15px_rgba(0,255,102,0.2)] hover:shadow-[0_0_25px_rgba(0,255,102,0.5)] italic"
            >
              Proceed to Login
            </Link>
          </div>
        </div>
      ) : (
        <form 
          onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }}
          className="space-y-6 relative z-10"
          suppressHydrationWarning
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 text-[10px] p-3 rounded-sm font-black uppercase tracking-widest text-center animate-pulse">
              {error}
            </div>
          )}

          <div className="bg-surface-hover border border-surface-border p-3 rounded-sm text-center">
            <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-1">TARGET EMAIL</span>
            <span className="text-xs font-mono font-bold text-main">{email}</span>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">New Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="new-password"
              className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
              placeholder="••••••••"
              suppressHydrationWarning
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Confirm New Password</label>
            <input 
              type="password" 
              required 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="new-password"
              className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
              placeholder="••••••••"
              suppressHydrationWarning
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !password || !confirmPassword}
            className="w-full bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-wider py-4 rounded-sm transition-all shadow-[0_0_15px_rgba(0,255,102,0.2)] hover:shadow-[0_0_25px_rgba(0,255,102,0.5)] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed flex justify-center items-center italic"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
            ) : (
              "Confirm Password Reset"
            )}
          </button>
        </form>
      )}
    </div>
  );
}

"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { validate, sanitize } from '@/lib/validation-utils';

export default function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });

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

  const validateInput = () => {
    let err: string | null = null;
    
    err = validate("USERNAME", formData.username);
    if (err) { setError(err); return false; }
    
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

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateInput()) return;

    setLoading(true);

    try {
      const lowerUsername = formData.username.toLowerCase();
      const usernameDoc = await getDoc(doc(db, "usernames", lowerUsername));
      
      if (usernameDoc.exists()) {
        setError("IDENTITY ALREADY IN USE. CHOOSE A UNIQUE HANDLE.");
        setLoading(false);
        return;
      }

      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      const user = userCredential.user;

      // 2. Set Display Name in Auth
      await updateProfile(user, {
        displayName: formData.username
      });

      // 3. Create Firestore Profile
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        username: formData.username.toLowerCase(),
        email: formData.email,
        phone: formData.phone,
        avatarId: Math.floor(Math.random() * 20),
        balanceCoins: 0,
        totalWins: 0,
        createdAt: serverTimestamp(),
      });

      // 4. Reserve Name
      await setDoc(doc(db, "usernames", lowerUsername), {
        uid: user.uid
      });

      // 4. Force hard redirect to clear auth state race conditions
      setError("AUTHENTICATION SUCCESS. ENTERING DASHBOARD...");
      window.location.href = '/dashboard';
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
          Join <span className="text-accent">The Ladder</span>
        </h1>
        <p className="text-sub mt-2 text-sm font-bold tracking-tight">Register to start backing your skills.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500 text-red-500 text-[10px] p-3 rounded-sm font-black uppercase tracking-widest text-center animate-pulse">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Username</label>
            <input 
              type="text" 
              name="username"
              required 
              value={formData.username}
              onChange={handleChange}
              className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold text-xs"
              placeholder="GamerTag"
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
              className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
              placeholder="080..."
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Email Address</label>
          <input 
            type="email" 
            name="email"
            required 
            value={formData.email}
            onChange={handleChange}
            className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
            placeholder="player@example.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                name="password"
                required 
                value={formData.password}
                onChange={handleChange}
                className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 pr-10 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-accent transition-colors"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-sub mb-2 ml-1">Confirm</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                name="confirmPassword"
                required 
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full bg-surface-hover border border-surface-border focus:border-accent text-main px-4 py-3 pr-10 rounded-sm outline-none transition-all placeholder-gray-600 font-bold font-mono text-xs"
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-accent transition-colors"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-wider py-4 rounded-sm transition-all shadow-[0_0_15px_rgba(0,255,102,0.2)] hover:shadow-[0_0_25px_rgba(0,255,102,0.5)] mt-4 border-2 border-transparent disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center italic"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
          ) : (
             "Enter The Lobby"
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-sub relative z-10 font-bold uppercase tracking-widest text-[9px]">
        Already playing?{' '}
        <Link href="/login" className="text-accent hover:text-accent-hover transition-all underline">
          SignIn
        </Link>
      </div>
    </div>
  );
}

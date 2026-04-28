"use client";
import React, { useState, useEffect, useRef } from "react";
import { ShieldAlert, X, Check, Lock, ShieldCheck } from "lucide-react";

interface AdminPinTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
  title: string;
  error?: string | null;
}

export default function AdminPinTerminal({
  isOpen,
  onClose,
  onSuccess,
  title,
  error: externalError
}: AdminPinTerminalProps) {
  const [pin, setPin] = useState<string[]>(new Array(6).fill(""));
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPin(new Array(6).fill(""));
      setLocalError(null);
      setIsSubmitting(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen, title]);

  useEffect(() => {
    if (externalError) {
      setLocalError(externalError);
      setIsSubmitting(false);
      // Shake animation effect could be added here via class
    }
  }, [externalError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    if (isNaN(Number(val))) return;

    const newPin = [...pin];
    newPin[index] = val.substring(val.length - 1);
    setPin(newPin);

    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && pin.every(v => v !== "")) {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const fullPin = pin.join("");
    if (fullPin.length !== 6) {
      setLocalError("SECURITY_ERROR: Full 6-digit sequence required.");
      return;
    }
    setIsSubmitting(true);
    onSuccess(fullPin);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 sm:p-0">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="bg-[#0a0a0a] border border-white/5 w-full max-w-sm rounded-sm relative overflow-hidden animate-in zoom-in-95 duration-200 shadow-[0_0_100px_rgba(0,255,102,0.1)]">
        {/* Security Bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-accent shadow-[0_0_15px_rgba(0,255,102,0.5)]" />
        
        {/* Header */}
        <div className="p-8 pb-4 text-center">
           <div className={`inline-flex p-4 rounded-full border mb-4 shadow-[0_0_30px_rgba(0,255,102,0.1)] ${title.includes("Set") ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-accent/10 border-accent/20 text-accent"}`}>
              <ShieldCheck className={`w-8 h-8 ${title.includes("Set") ? "animate-bounce" : "animate-pulse"}`} />
           </div>
           <h3 className="text-lg font-black text-white uppercase italic tracking-tighter leading-none mb-2">{title}</h3>
           <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">
             {title.includes("Set") ? "Master Key Initialization" : "Identity Verification Required"}
           </p>
        </div>

        {/* PIN Grid */}
        <div className="px-8 py-6">
           <div className="flex justify-between gap-2 mb-6">
              {pin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { inputRefs.current[idx] = el; }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  disabled={isSubmitting}
                  onChange={(e) => handleChange(e, idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  className={`w-10 h-12 bg-white/5 border text-center text-xl font-black rounded-sm outline-none transition-all ${title.includes("Set") ? "border-blue-500/30 text-blue-400 focus:border-blue-400 focus:bg-blue-500/5" : "border-white/10 text-accent focus:border-accent focus:bg-accent/5"}`}
                />
              ))}
           </div>

           {(localError || externalError) && (
             <div className={`border p-3 rounded-sm flex items-start gap-3 animate-in slide-in-from-top-2 ${title.includes("Set") ? "bg-blue-500/10 border-blue-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${title.includes("Set") ? "text-blue-400" : "text-red-500"}`} />
                <p className={`text-[10px] font-black uppercase tracking-widest leading-tight ${title.includes("Set") ? "text-blue-400" : "text-red-500"}`}>
                  {localError || externalError}
                </p>
             </div>
           )}
        </div>

        {/* Footer */}
        <div className="p-8 pt-0 flex flex-col gap-3">
           <button 
             onClick={handleSubmit}
             disabled={isSubmitting || pin.some(v => v === "")}
             className={`w-full py-4 text-black text-[10px] font-black uppercase tracking-widest transition-all rounded-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-30 disabled:grayscale ${title.includes("Set") ? "bg-blue-500 hover:bg-blue-400 shadow-blue-500/20" : "bg-accent hover:bg-accent-aware shadow-accent/20"}`}
           >
             {isSubmitting ? <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span> : <>{title.includes("Set") ? <Check className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />} {title.includes("Set") ? "Register Master PIN" : "Confirm Identity"}</>}
           </button>
           
           <button 
             onClick={onClose}
             disabled={isSubmitting}
             className="w-full py-3 text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-gray-400 transition-all"
           >
             Abort Security Protocol
           </button>
        </div>

        {/* Warning Watermark */}
        <div className="absolute bottom-0 left-0 w-full p-2 bg-red-500/5 border-t border-red-500/10 text-center">
           <p className="text-[7px] text-red-500/50 font-black uppercase tracking-[0.5em]">Unauthorized Access is Prohibited // Audit ID: {Math.random().toString(36).substring(7).toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
}

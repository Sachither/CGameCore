"use client";

import React, { useState, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { disputeMatchWithDiscordAction } from '@/app/actions/discord-actions';
import { CheckCircle2, Loader2, AlertTriangle, Image as ImageIcon, Video } from 'lucide-react';

export default function DisputeModal({ isOpen, onClose, matchId, username }: { 
  isOpen: boolean, 
  onClose: () => void,
  matchId: string,
  username: string
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!user) return;
    if (!reason.trim()) {
      setError("Please provide a detailed reason for the dispute.");
      return;
    }
    // Evidence is now optional - users can submit without screenshots/videos
    // They can reach out to support even if they forgot to take evidence

    setIsSubmitting(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const formData = new FormData();
      formData.append("idToken", idToken);
      formData.append("matchId", matchId);
      formData.append("reason", reason);
      formData.append("username", username);
      if (imageFile) formData.append("image", imageFile);
      if (videoFile) formData.append("video", videoFile);

      const res = await disputeMatchWithDiscordAction(formData);
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || "Tactical upload failed.");
      }
    } catch (e: any) {
      setError(e.message || "Connection timeout.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-surface border border-surface-border p-6 w-full max-w-lg rounded-sm shadow-2xl relative overflow-hidden">
        {/* Aesthetic background accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 -rotate-45 translate-x-16 -translate-y-16 pointer-events-none" />

        {success ? (
          <div className="text-center py-10 animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(0,255,102,0.1)]">
              <CheckCircle2 className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-white font-black uppercase tracking-[0.2em] text-xl italic mb-2">Evidence Vaulted</h3>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest max-w-[80%] mx-auto leading-relaxed">
              The Tribunal has received your transmission. Match funds are now frozen pending a manual audit by Command.
            </p>
            <button 
              onClick={onClose} 
              className="mt-8 w-full sm:w-auto bg-accent text-black px-10 py-3 rounded-sm font-black uppercase text-[10px] tracking-widest hover:bg-accent-hover transition-colors shadow-lg"
            >
              Return to Base
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-red-500/10 p-2 rounded-sm">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-white font-black uppercase tracking-widest text-lg italic leading-tight">File Dispute</h3>
                <p className="text-[9px] text-red-500/60 font-black uppercase tracking-[0.2em]">Escrow Freeze Protocol</p>
              </div>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest block mb-2">Dispute Reason / Claim</label>
                    <textarea 
                      className="w-full bg-black border border-surface-border p-4 text-white text-xs min-h-[100px] outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-700 font-medium"
                      placeholder="Explain exactly what happened (e.g., Match result mismatch, cheating, disconnected host)..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   {/* Image Drop Zone */}
                   <div onClick={() => imageInputRef.current?.click()} className="group">
                     <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest block mb-2 flex justify-between">
                       Screenshot <span className={imageFile ? "text-green-400" : "text-accent"}>{imageFile ? "✓ Uploaded" : "Optional"}</span>
                     </label>
                     <input 
                        type="file" ref={imageInputRef} hidden accept="image/*" 
                        onChange={e => setImageFile(e.target.files?.[0] || null)} 
                     />
                     <div className={`border border-dashed transition-all duration-300 ${imageFile ? 'border-green-500/50 bg-green-500/5' : 'border-surface-border group-hover:border-gray-500 bg-black'} h-32 rounded-[3px] flex flex-col items-center justify-center cursor-pointer`}>
                         <ImageIcon className={`w-6 h-6 ${imageFile ? 'text-green-500' : 'text-gray-600 group-hover:text-gray-400'} mb-2`} />
                         <span className={`text-[9px] font-black ${imageFile ? 'text-green-400' : 'text-gray-500'} uppercase tracking-widest text-center px-4 line-clamp-1`}>{imageFile ? imageFile.name : "Select Image"}</span>
                     </div>
                   </div>

                   {/* Video Drop Zone */}
                   <div onClick={() => videoInputRef.current?.click()} className="group">
                     <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest block mb-2 flex justify-between">
                       Video Proof <span className={videoFile ? "text-green-400" : "text-red-400"}>{videoFile ? "✓ Uploaded" : "Optional"}</span>
                     </label>
                     <input 
                        type="file" ref={videoInputRef} hidden accept="video/*" 
                        onChange={e => setVideoFile(e.target.files?.[0] || null)} 
                     />
                     <div className={`border border-dashed transition-all duration-300 ${videoFile ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/20 group-hover:border-red-500/40 bg-red-500/5'} h-32 rounded-[3px] flex flex-col items-center justify-center cursor-pointer relative overflow-hidden`}>
                         {!videoFile && <div className="absolute top-1 right-2 text-[7px] text-red-500/40 font-black tracking-widest uppercase">Discord Vault</div>}
                         <Video className={`w-6 h-6 ${videoFile ? 'text-green-500' : 'text-red-500/30 group-hover:text-red-400/60'} mb-2`} />
                         <span className={`text-[9px] font-black ${videoFile ? 'text-green-400' : 'text-red-400/50'} uppercase px-4 text-center leading-tight line-clamp-1`}>{videoFile ? videoFile.name : "Attach Clip"}</span>
                     </div>
                   </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-3 flex items-center gap-3 animate-shake">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{error}</p>
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={onClose} 
                        disabled={isSubmitting}
                        className="flex-1 bg-black border border-surface-border py-4 text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] hover:text-white hover:border-gray-600 transition-all disabled:opacity-50"
                    >
                        Abandon
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting} 
                        className="flex-[2] bg-red-600 text-white py-4 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-red-700 transition-all active:scale-95 disabled:bg-gray-800 disabled:text-gray-500 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Transmitting...
                            </>
                        ) : (
                            "Initiate Tribunal"
                        )}
                    </button>
                </div>

                <p className="text-[8px] text-center text-gray-600 font-bold uppercase tracking-widest">
                    WARNING: Falsifying evidence will result in a permanent dishonorable discharge.
                </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useRef } from 'react';
import { X, Trophy, Info, Loader2, Zap, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import { submitHofEntryAction } from '@/app/actions/hof-actions';
import { getR2PresignedUrlAction } from '@/app/actions/r2-actions';
import { HofCategory } from '@/lib/hof-service';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/context/ToastContext';
import { auth } from '@/lib/firebase';

interface HofSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HofSubmissionModal({ isOpen, onClose }: HofSubmissionModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<HofCategory>('eFOOTBALL_GOAL');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // 50MB Limit Check
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error("DATA BOMB DETECTED", "File exceeds 50MB. Please trim your clip or record at 720p for deployment.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFile(selectedFile);

    // Create preview
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;

    setLoading(true);
    setUploadProgress(5);

    try {
      // 1. Get Fresh Token
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Authentication sync lost.");

      setUploadProgress(15);

      // 2. Get Presigned URL
      const r2Res = await getR2PresignedUrlAction(idToken, file.name, file.type);
      if (!r2Res.success || !r2Res.signedUrl) {
        throw new Error(r2Res.error || "Vault uplink rejected.");
      }

      setUploadProgress(25);

      // 3. Direct Upload to Cloudflare R2
      const uploadResponse = await fetch(r2Res.signedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Data transmission failure.");
      }

      setUploadProgress(75);

      // 4. Register in Database
      const res = await submitHofEntryAction(idToken, r2Res.publicUrl!, category) as { success: boolean; error?: string };

      if (res.success) {
        setUploadProgress(100);
        toast.success("MISSION SUCCESS", "Your combat footage is live. Awaiting community votes.");
        setTimeout(() => {
          onClose();
          handleReset();
        }, 1500);
      } else {
        throw new Error(res.error || "Database sync failed.");
      }
    } catch (err: any) {
      toast.error("MISSION FAILED", err.message || "System error during deployment.");
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl overflow-y-auto">
      <div className="relative w-full max-w-lg bg-surface border border-surface-border rounded-sm shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-surface-hover p-6 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-xl font-black text-main italic uppercase tracking-tighter">Submit Your <span className="text-accent">Play</span></h3>
              <p className="text-[10px] text-sub font-bold uppercase tracking-widest">Direct Tactical Uplink</p>
            </div>
          </div>
          <button onClick={onClose} className="text-sub hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Guidance Box */}
          <div className="p-4 bg-accent/5 border border-accent/10 rounded-sm space-y-2">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-accent shrink-0" />
              <p className="text-[10px] text-accent font-black uppercase tracking-widest italic">Tactical Briefing</p>
            </div>
            <p className="text-[11px] text-gray-400 font-medium leading-relaxed pl-6">
              Max size: <span className="text-white font-bold">50MB</span>. If your recording is too large, trim it to under 45 seconds or record at <span className="text-white font-bold">720p</span> for a successful deployment.
            </p>
          </div>

          {/* Category Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-sub italic">Select Theatre</label>
            <div className="grid grid-cols-2 gap-3">
              {(['eFOOTBALL_GOAL', 'CODM_WIPE'] as HofCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`py-3 px-2 text-[9px] font-black uppercase tracking-widest rounded-sm border transition-all ${category === cat
                      ? 'bg-accent text-black border-accent'
                      : 'bg-white/5 text-sub border-white/10 hover:bg-white/10'
                    }`}
                >
                  {cat === 'eFOOTBALL_GOAL' ? "eFootball Goal" : "CODM Wipeout"}
                </button>
              ))}
            </div>
          </div>

          {/* Enhanced File Upload/Preview Area */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-sub italic">Evidence Footage</label>
            <div
              onClick={() => !loading && fileInputRef.current?.click()}
              className={`relative w-full aspect-video border-2 border-dashed rounded-sm flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden ${file ? 'border-accent bg-black' : 'border-surface-border hover:border-accent/40 bg-black'
                } ${loading ? 'opacity-50 cursor-wait' : ''}`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                disabled={loading}
              />

              {previewUrl ? (
                <div className="w-full h-full relative group">
                  <video
                    src={previewUrl}
                    className="w-full h-full object-contain"
                    muted
                    playsInline
                    autoPlay
                    loop
                  />
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload className="w-8 h-8 text-white mb-2" />
                    <span className="text-[10px] text-white font-black uppercase tracking-widest italic">Replace File</span>
                  </div>
                  {/* Meta Overlay */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/80 backdrop-blur-md rounded-sm border border-white/10">
                    <span className="text-[9px] text-white font-mono font-bold uppercase">
                      {(file?.size || 0) / (1024 * 1024) < 1 ? 'Small File' : `${((file?.size || 0) / (1024 * 1024)).toFixed(1)}MB`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                    <Upload className="w-6 h-6 text-sub group-hover:text-accent" />
                  </div>
                  <span className="text-xs text-white font-black uppercase tracking-widest italic">Click to Upload Footage</span>
                  <span className="text-[9px] text-sub uppercase mt-2 tracking-widest font-bold">.mp4 / .mov / .webm allowed</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress Tracking */}
          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                <span className="text-accent italic">Uplink in Progress</span>
                <span className="text-white">{uploadProgress}%</span>
              </div>
              <div className="w-full h-1 bg-surface-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300 shadow-[0_0_10px_#00FF66]"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Tactical Footer */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-4 border border-surface-border text-sub hover:text-white font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-30"
            >
              Abort
            </button>
            <button
              disabled={loading || !file}
              className="flex-[2] py-4 bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest text-[10px] italic transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(0,255,102,0.1)] disabled:opacity-50 disabled:grayscale"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  DEPLOYING...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  CONFIRM DEPLOYMENT
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

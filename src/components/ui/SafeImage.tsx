/**
 * Safe Image Component
 *
 * Displays images with timeout protection to prevent DoS attacks
 * from slow-loading or malicious proof URLs.
 *
 * SECURITY FIXES:
 * - PHASE 4: Proof URL timeout handling
 */

"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ImageIcon, AlertTriangle } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  timeout?: number; // milliseconds
  fallbackText?: string;
}

export default function SafeImage({
  src,
  alt,
  className = "",
  timeout = 10000, // 10 second timeout
  fallbackText = "No Image Available"
}: SafeImageProps) {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error' | 'timeout'>('loading');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setImageState('error');
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let img: HTMLImageElement;

    // Set timeout
    timeoutId = setTimeout(() => {
      setImageState('timeout');
    }, timeout);

    // Create image to test loading
    img = new window.Image();
    img.onload = () => {
      clearTimeout(timeoutId);
      setImageState('loaded');
      setImageUrl(src);
    };
    img.onerror = () => {
      clearTimeout(timeoutId);
      setImageState('error');
    };
    img.src = src;

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [src, timeout]);

  if (imageState === 'loading') {
    return (
      <div className={`flex items-center justify-center bg-gray-800 border border-gray-600 rounded-sm ${className}`}>
        <div className="text-center p-4">
          <div className="animate-spin w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  if (imageState === 'loaded' && imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        className={className}
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      />
    );
  }

  if (imageState === 'timeout') {
    return (
      <div className={`flex items-center justify-center bg-red-900/20 border border-red-500/30 rounded-sm ${className}`}>
        <div className="text-center p-4">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-[9px] text-red-400 font-black uppercase tracking-widest">TIMEOUT</p>
          <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-1">Image took too long to load</p>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className={`flex items-center justify-center bg-gray-800 border border-gray-600 rounded-sm ${className}`}>
      <div className="text-center p-4">
        <ImageIcon className="w-6 h-6 text-gray-600 mx-auto mb-2" />
        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{fallbackText}</p>
      </div>
    </div>
  );
}
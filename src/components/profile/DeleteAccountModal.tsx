'use client';

import { useState } from 'react';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DeleteAccountModal({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText.toLowerCase() === 'delete my account';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      {/* Modal Card */}
      <div className="w-full max-w-md bg-surface border-2 border-accent rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header with Warning Icon */}
        <div className="bg-gradient-to-r from-red-900/30 to-red-800/20 border-b border-red-700/50 px-6 py-8 flex flex-col items-center gap-3 flex-shrink-0">
          <div className="w-16 h-16 bg-red-900/40 rounded-full flex items-center justify-center border border-red-700/50">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0-10.5a10.5 10.5 0 1 1-21 0 10.5 10.5 0 0 1 21 0Z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent text-center">
            Delete Account?
          </h2>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-6 space-y-5">
          <p className="text-sm text-sub leading-relaxed">
            This action is <span className="font-bold text-accent">permanent and irreversible</span>. You will lose:
          </p>

          {/* Warning List */}
          <div className="bg-surface-hover border border-red-700/20 rounded-md p-4 space-y-2">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">All account balances and coins</span>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">Complete match history</span>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">Profile and statistics</span>
            </div>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <label htmlFor="confirmInput" className="text-xs font-semibold text-sub uppercase tracking-wider">
              Type to confirm:
            </label>
            <input
              id="confirmInput"
              type="text"
              placeholder="delete my account"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full bg-surface-hover border border-surface-border rounded-md px-4 py-2 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-colors"
            />
            <p className="text-xs text-sub">
              {confirmText.toLowerCase() === 'delete my account' ? (
                <span className="text-green-400">✓ Confirmed</span>
              ) : (
                <span>Type exactly "delete my account" to proceed</span>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-surface-hover border-t border-surface-border px-6 py-4 flex gap-3 flex-shrink-0">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-surface-hover border border-surface-border rounded-md text-sm font-semibold hover:bg-surface-hover/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmed || isLoading}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md text-sm font-semibold hover:from-red-700 hover:to-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

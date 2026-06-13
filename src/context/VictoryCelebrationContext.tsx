"use client";
import React, { createContext, useContext, useState } from 'react';
import VictoryCelebrationModal from '@/components/match/VictoryCelebrationModal';

export interface VictoryData {
  playerName: string;
  gameLabel: string;
  prizeAmount: number;
  isTournamentChampion: boolean;
  rewardType: 'COINS' | 'USD';
}

interface VictoryCelebrationContextType {
  isOpen: boolean;
  victoryData: VictoryData | null;
  showVictory: (data: VictoryData) => void;
  hideVictory: () => void;
}

const VictoryCelebrationContext = createContext<VictoryCelebrationContextType | undefined>(undefined);

export function VictoryCelebrationProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [victoryData, setVictoryData] = useState<VictoryData | null>(null);

  const showVictory = (data: VictoryData) => {
    setVictoryData(data);
    setIsOpen(true);
  };

  const hideVictory = () => {
    setIsOpen(false);
    // Clear data after modal closes
    setTimeout(() => setVictoryData(null), 300);
  };

  return (
    <VictoryCelebrationContext.Provider value={{ isOpen, victoryData, showVictory, hideVictory }}>
      {children}
      {victoryData && (
        <VictoryCelebrationModal
          isOpen={isOpen}
          onClose={hideVictory}
          playerName={victoryData.playerName}
          gameLabel={victoryData.gameLabel}
          prizeAmount={victoryData.prizeAmount}
          isTournamentChampion={victoryData.isTournamentChampion}
          rewardType={victoryData.rewardType}
        />
      )}
    </VictoryCelebrationContext.Provider>
  );
}

export function useVictoryCelebration() {
  const context = useContext(VictoryCelebrationContext);
  if (!context) {
    throw new Error('useVictoryCelebration must be used within VictoryCelebrationProvider');
  }
  return context;
}

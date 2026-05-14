import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

export type HofCategory = 'eFOOTBALL_GOAL' | 'CODM_WIPE';

export interface HofEntry {
  id?: string;
  uid: string;
  username: string;
  avatarId: number;
  videoUrl: string;
  embedType: 'DIRECT';
  category: HofCategory;
  weekKey: string; // e.g., "2026-W19"
  voterUids: string[];
  voteCount: number;
  status: 'ACTIVE' | 'WINNER' | 'PENDING';
  createdAt: any;
}

/**
 * Gets the readable title for a category
 */
export function getHofCategoryTitle(cat: HofCategory): string {
  if (cat === 'eFOOTBALL_GOAL') return "eFootball Best Goal of the Week";
  if (cat === 'CODM_WIPE') return "Best CODM Squad Wipeout";
  return cat;
}

/**
 * Gets the current week identifier for the Hall of Fame
 */
export function getHofWeekKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  // Simple week calculation
  const oneJan = new Date(year, 0, 1);
  const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
  return `${year}-W${weekNum}`;
}

/**
 * Gets the previous week identifier
 */
export function getPrevWeekKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const year = d.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
  return `${year}-W${weekNum}`;
}

/**
 * Determines current phase:
 * Mon-Wed (00:00 - 18:00): SUBMISSION
 * Wed (18:01) - Sun: VOTING
 */
export function getHofPhase(): 'SUBMISSION' | 'VOTING' {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 3=Wed
  const hour = d.getHours();

  if (day >= 1 && day < 3) return 'SUBMISSION';
  if (day === 3 && hour < 18) return 'SUBMISSION';
  return 'VOTING';
}

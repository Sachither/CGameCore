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
 * Uses ISO 8601 week date: Week starts Monday, changes only on Monday midnight
 */
export function getHofWeekKey(): string {
  const d = new Date();
  return getIsoWeekKey(d);
}

/**
 * Gets the previous week identifier
 */
export function getPrevWeekKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return getIsoWeekKey(d);
}

/**
 * Helper: Convert date to ISO 8601 week format (YYYY-Www)
 * Week 1 is the first week with a Thursday in it
 * Week starts Monday (day 1), ends Sunday (day 7)
 */
function getIsoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1=Monday, 7=Sunday
  d.setUTCDate(d.getUTCDate() - dayNum + 1); // Move to Monday of that week
  
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const yearStartDay = yearStart.getUTCDay() || 7;
  yearStart.setUTCDate(yearStart.getUTCDate() - yearStartDay + 1);
  
  const weekMs = (d.getTime() - yearStart.getTime()) / (7 * 24 * 60 * 60 * 1000);
  const weekNum = Math.floor(weekMs) + 1;
  const year = d.getUTCFullYear();
  
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
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

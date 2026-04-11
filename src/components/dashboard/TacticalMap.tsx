"use client";
import React from 'react';
import { Circuit, Match } from '@/lib/match-service';
import { X, Trophy, Swords, Target, Activity, ShieldCheck, ChevronRight, Users, Clock, Zap, Crown, ShieldAlert } from 'lucide-react';

interface Props {
  competition: Circuit;
  allMatches?: Match[];
  isOpen: boolean;
  onClose: () => void;
}

export default function TacticalMap({ competition, allMatches, isOpen, onClose }: Props) {
  if (!isOpen) return null;

  const isCircuit = true;

  // Get all tournament matches sorted by creation time
  const tournamentMatches = allMatches?.filter(m => {
    // For circuits (tournaments), only matches with matching circuitId AND a round
    // This filters out the gathering match which has no round
    return m.circuitId === competition.id && m.round;
  }).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)) || [];

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-300 overflow-hidden">

      {/* Header Bar */}
      <div className="flex items-center justify-between p-6 border-b border-white/5 bg-surface/20">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-accent/20 border border-accent/40 rotate-45 flex items-center justify-center">
               <Target className="w-5 h-5 text-accent -rotate-45" />
            </div>
            <div>
               <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                  Full Tactical <span className="text-accent">Map</span>
               </h2>
               <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] italic mt-1">
                  Sector: {competition.title} // Ops Status: Active
               </p>
            </div>
         </div>

         <button
           onClick={onClose}
           className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-full transition-all group"
         >
            <X className="w-6 h-6 transition-transform group-hover:rotate-90" />
         </button>
      </div>

      {/* Main Map Viewport */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar">
         <div className="max-w-7xl mx-auto space-y-24">

            {/* Tournament Bracket Visualization */}
            <section className="space-y-12">
               <div className="flex items-center gap-6">
                  <h3 className="text-xl font-black text-white italic uppercase tracking-widest shrink-0 flex items-center gap-3">
                     <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                     Elimination Bracket
                  </h3>
                  <div className="h-px bg-white/5 flex-1" />
               </div>

               <FullTournamentBracket
                 competition={competition}
                 matches={tournamentMatches}
               />
            </section>

            {/* Footer Branding */}
            <div className="flex justify-center pb-24">
               <div className="flex items-center gap-8 opacity-20">
                  <Swords className="w-8 h-8 text-white" />
                  <div className="w-px h-12 bg-white/20" />
                  <h4 className="text-[10px] font-black text-white uppercase tracking-[1em] italic">High Stakes EFootball // Tactical Interface</h4>
               </div>
            </div>

         </div>
      </div>
    </div>
  );
}

// Full Tournament Bracket Component
function FullTournamentBracket({ competition, matches }: { competition: Circuit, matches: Match[] }) {
  // Group matches by round - properly categorize tournament rounds
  // QR1, QR2 are Round of 16 matches, not separate rounds
  const roundOf16 = matches.filter(m =>
    m.round === 'QR1' ||
    m.round === 'QR2' ||
    (!m.round && matches.indexOf(m) < 8)
  );

  const quarters = matches.filter(m =>
    m.round === 'QF' ||
    m.round?.startsWith('QF')
  );

  const semis = matches.filter(m =>
    m.round === 'SF' ||
    m.round?.startsWith('SF')
  );

  const finals = matches.filter(m =>
    m.round === 'FINAL' ||
    m.round?.startsWith('FINAL')
  );

  // DEBUG: Check for true duplicate players (same player twice in same match or twice in same round)
  const playerMatchMap: { [playerUid: string]: string[] } = {};
  const playerRoundMap: { [playerUid: string]: string[] } = {};
  const matchValidation: any[] = [];
  const duplicatePlayers: string[] = [];
  
  matches.forEach(match => {
    if (!match.id) return; // Skip matches without IDs
    
    const players = Object.values(match.players || {});
    const playerUids = players.map((p: any) => p.uid);
    
    // Check if same player appears twice in same match
    const uniqueUidsInMatch = new Set(playerUids);
    if (uniqueUidsInMatch.size !== playerUids.length) {
      // Same player twice in this match
      playerUids.forEach(uid => {
        const count = playerUids.filter(u => u === uid).length;
        if (count > 1 && !duplicatePlayers.includes(uid)) {
          duplicatePlayers.push(uid);
        }
      });
    }
    
    matchValidation.push({
      id: match.id,
      round: match.round,
      playerCount: players.length,
      players: playerUids,
      status: match.status,
      circuitId: match.circuitId,
      leagueId: match.leagueId,
      format: match.format
    });
    
    players.forEach((player: any) => {
      if (!playerMatchMap[player.uid]) {
        playerMatchMap[player.uid] = [];
      }
      playerMatchMap[player.uid].push(match.id!);
      
      // Track which rounds player appears in
      const roundKey = match.round || 'NONE';
      if (!playerRoundMap[player.uid]) {
        playerRoundMap[player.uid] = [];
      }
      if (!playerRoundMap[player.uid].includes(roundKey)) {
        playerRoundMap[player.uid].push(roundKey);
      }
    });
  });

  // Check if any player is in multiple matches in the SAME ROUND (true duplicate)
  const playersInMultipleMatchesSameRound: string[] = [];
  matches.forEach(match => {
    const players = Object.values(match.players || {});
    const playerUids = players.map((p: any) => p.uid);
    const uniqueInThisRound = new Set(playerUids);
    
    // If more players than unique UIDs in this round, we have a duplicate
    if (uniqueInThisRound.size < playerUids.length) {
      playerUids.forEach(uid => {
        if (!playersInMultipleMatchesSameRound.includes(uid)) {
          playersInMultipleMatchesSameRound.push(uid);
        }
      });
    }
  });

  // Only flag as duplicate if player appears in multiple matches of same round
  if (playersInMultipleMatchesSameRound.length > 0) {
    playersInMultipleMatchesSameRound.forEach(uid => {
      if (!duplicatePlayers.includes(uid)) {
        duplicatePlayers.push(uid);
      }
    });
  }

  if (duplicatePlayers.length > 0) {
    console.warn("BRACKET ANOMALY: DUPLICATE PLAYERS DETECTED - PROCEEDING WITH CAUTION");
  }

  // Check for matches with wrong number of players
  const invalidMatches = matchValidation.filter(m => m.playerCount !== 2);

  // Fixed: Show actual counts vs expected tournament structure
  // Round of 16: always 8 matches (4 QR1 + 4 QR2)
  // Quarters: 4 matches
  // Semis: 2 matches
  // Final: 1 match
  const expectedRoundOf16 = 8;
  const expectedQuarters = 4;
  const expectedSemis = 2;
  const expectedFinals = 1;

  // Only show rounds that have matches or are expected based on tournament progress
  const showRoundOf16 = roundOf16.length > 0 || matches.length > 0;
  const showQuarters = quarters.length > 0 || roundOf16.some(m => m.status === 'CLOSED' || m.status === 'COMPLETED');
  const showSemis = semis.length > 0 || quarters.some(m => m.status === 'CLOSED' || m.status === 'COMPLETED');
  const showFinals = finals.length > 0 || semis.some(m => m.status === 'CLOSED' || m.status === 'COMPLETED');

  return (
    <div className="relative">
      {/* Tournament Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {showRoundOf16 && (
          <StatusCard
            title="Round of 16"
            completed={roundOf16.filter(m => m.status === 'CLOSED' || m.status === 'COMPLETED').length}
            total={expectedRoundOf16}
            icon={<Users className="w-4 h-4" />}
            color="blue"
          />
        )}
        {showQuarters && (
          <StatusCard
            title="Quarter Finals"
            completed={quarters.filter(m => m.status === 'CLOSED' || m.status === 'COMPLETED').length}
            total={expectedQuarters}
            icon={<Swords className="w-4 h-4" />}
            color="yellow"
          />
        )}
        {showSemis && (
          <StatusCard
            title="Semi Finals"
            completed={semis.filter(m => m.status === 'CLOSED' || m.status === 'COMPLETED').length}
            total={expectedSemis}
            icon={<ShieldCheck className="w-4 h-4" />}
            color="orange"
          />
        )}
        {showFinals && (
          <StatusCard
            title="Final"
            completed={finals.filter(m => m.status === 'CLOSED' || m.status === 'COMPLETED').length}
            total={expectedFinals}
            icon={<Crown className="w-4 h-4" />}
            color="accent"
          />
        )}
      </div>

      {/* Bracket Visualization */}
      <div className="space-y-16">
        {/* Round of 16 */}
        {showRoundOf16 && (
          <RoundSection
            title="Round of 16"
            subtitle="First Blood - 8 Matches (QR1 & QR2)"
            matches={roundOf16}
            competition={competition}
            maxMatches={expectedRoundOf16}
          />
        )}

        {/* Quarter Finals */}
        {showQuarters && (
          <RoundSection
            title="Quarter Finals"
            subtitle="Elite Eight - 4 Matches"
            matches={quarters}
            competition={competition}
            maxMatches={expectedQuarters}
          />
        )}

        {/* Semi Finals */}
        {showSemis && (
          <RoundSection
            title="Semi Finals"
            subtitle="Final Four - 2 Matches"
            matches={semis}
            competition={competition}
            maxMatches={expectedSemis}
          />
        )}

        {/* Final */}
        {showFinals && (
          <RoundSection
            title="Grand Final"
            subtitle="Championship - 1 Match"
            matches={finals}
            competition={competition}
            maxMatches={expectedFinals}
            isFinal={true}
          />
        )}

        {/* Show message if no matches yet */}
        {matches.length === 0 && (
          <div className="text-center py-20">
            <Clock className="w-16 h-16 text-gray-600 mx-auto mb-6" />
            <h4 className="text-xl font-black text-gray-600 uppercase tracking-wider italic mb-4">
              Tournament Initializing
            </h4>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.3em] max-w-md mx-auto">
              Awaiting first round matchups. Players will be paired and brackets revealed as the tournament begins.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Round Section Component
function RoundSection({
  title,
  subtitle,
  matches,
  competition,
  maxMatches,
  isFinal = false
}: {
  title: string;
  subtitle: string;
  matches: Match[];
  competition: Circuit;
  maxMatches: number;
  isFinal?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          isFinal ? 'bg-accent/20 border-accent/40' : 'bg-white/5 border-white/10'
        } border`}>
          {isFinal ? (
            <Crown className="w-6 h-6 text-accent" />
          ) : (
            <Activity className="w-6 h-6 text-white" />
          )}
        </div>
        <div>
          <h4 className={`text-lg font-black uppercase tracking-wider ${
            isFinal ? 'text-accent' : 'text-white'
          } italic`}>
            {title}
          </h4>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">
            {subtitle}
          </p>
        </div>
      </div>

      <div className={`grid gap-4 ${
        maxMatches === 1 ? 'grid-cols-1 max-w-md mx-auto' :
        maxMatches === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto' :
        maxMatches === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8'
      }`}>
        {Array.from({ length: maxMatches }, (_, i) => {
          const match = matches[i];
          return (
            <MatchCard
              key={i}
              match={match}
              competition={competition}
              matchNumber={i + 1}
              isFinal={isFinal}
            />
          );
        })}
      </div>
    </div>
  );
}

// Individual Match Card
function MatchCard({
  match,
  competition,
  matchNumber,
  isFinal
}: {
  match?: Match;
  competition: Circuit;
  matchNumber: number;
  isFinal?: boolean;
}) {
  if (!match) {
    return (
      <div className="bg-black/40 border border-white/5 rounded-lg p-6 text-center min-h-[200px] flex flex-col items-center justify-center">
        <Clock className="w-8 h-8 text-gray-600 mb-3" />
        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-2">
          Match {matchNumber}
        </p>
        <p className="text-[9px] text-gray-500 uppercase italic">
          Awaiting Opponents
        </p>
      </div>
    );
  }

  const players = Object.values(match.players || {});
  const player1 = players[0];
  const player2 = players[1];

  const isCompleted = match.status === 'CLOSED' || match.status === 'COMPLETED';
  const isActive = match.status === 'IN_PROGRESS' || match.status === 'READY';

  // Determine winner and loser based on scores
  let winner: any = null;
  let loser: any = null;
  if (isCompleted && player1 && player2) {
    const score1 = (player1.scoreFor || player1.kills || 0);
    const score2 = (player2.scoreFor || player2.kills || 0);

    if (score1 > score2) {
      winner = player1;
      loser = player2;
    } else if (score2 > score1) {
      winner = player2;
      loser = player1;
    } else {
      // Tie - both eliminated or special handling needed
      winner = null;
      loser = null;
    }
  }

  return (
    <div className={`border rounded-lg p-6 min-h-[200px] flex flex-col transition-all ${
      isFinal ? 'bg-accent/5 border-accent/20' :
      isCompleted ? 'bg-green-500/5 border-green-500/20' :
      isActive ? 'bg-blue-500/5 border-blue-500/20' :
      'bg-black/40 border-white/5'
    }`}>

      {/* Match Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isActive && <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />}
          {isCompleted && <div className="w-2 h-2 bg-green-500 rounded-full" />}
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Match {matchNumber}
          </span>
        </div>
        <span className={`text-[8px] px-2 py-1 rounded-sm font-black uppercase tracking-widest ${
          isCompleted ? 'bg-green-500 text-black' :
          isActive ? 'bg-accent text-black' :
          'bg-gray-700 text-white'
        }`}>
          {isCompleted ? 'COMPLETED' :
           isActive ? 'LIVE' :
           match.status?.replace('_', ' ')}
        </span>
      </div>

      {/* Players */}
      <div className="space-y-3 flex-1">
        {[player1, player2].map((player, idx) => {
          if (!player) return null;

          const isWinner = winner?.uid === player.uid;
          const isLoser = loser?.uid === player.uid;
          const score = (player.scoreFor || player.kills || 0);

          return (
            <div key={player.uid} className={`flex items-center justify-between p-3 rounded-sm border transition-all ${
              isWinner ? 'bg-accent/10 border-accent/30' :
              isLoser ? 'bg-red-500/10 border-red-500/30' :
              'bg-white/5 border-white/10'
            }`}>

              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  isWinner ? 'bg-accent' :
                  isLoser ? 'bg-red-500' :
                  'bg-gray-600'
                }`} />
                <div>
                  <p className={`text-[11px] font-black uppercase italic ${
                    isWinner ? 'text-accent' :
                    isLoser ? 'text-red-400' :
                    'text-white'
                  }`}>
                    {player.username || 'Unknown'}
                  </p>
                  {isWinner && (
                    <p className="text-[8px] text-accent font-bold uppercase tracking-widest">
                      WINNER
                    </p>
                  )}
                  {isLoser && (
                    <p className="text-[8px] text-red-400 font-bold uppercase tracking-widest">
                      ELIMINATED
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className={`text-lg font-black tabular-nums ${
                  isWinner ? 'text-accent' :
                  isLoser ? 'text-red-400' :
                  'text-gray-300'
                }`}>
                  {score}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Match Actions */}
      {isActive && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <button className="w-full bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest text-[10px] py-2 rounded-sm transition-all flex items-center justify-center gap-2">
            <Zap className="w-3 h-3" />
            Enter Arena
          </button>
        </div>
      )}

      {isCompleted && winner && (
        <div className="mt-4 pt-4 border-t border-white/10 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-accent" />
            <span className="text-[10px] font-black text-accent uppercase tracking-widest">
              {winner.username} Advances
            </span>
          </div>
          <p className="text-[8px] text-gray-500 uppercase italic">
            Next opponent revealed after current round completes
          </p>
        </div>
      )}

      {isCompleted && !winner && !loser && (
        <div className="mt-4 pt-4 border-t border-white/10 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-yellow-500" />
            <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">
              Tie - Awaiting Resolution
            </span>
          </div>
          <p className="text-[8px] text-gray-500 uppercase italic">
            Tie-breaker match or admin intervention required
          </p>
        </div>
      )}
    </div>
  );
}

// Status Card Component
function StatusCard({
  title,
  completed,
  total,
  icon,
  color
}: {
  title: string;
  completed: number;
  total: number;
  icon: React.ReactNode;
  color: string;
}) {
  const percentage = (completed / total) * 100;
  const isComplete = completed >= total;

  return (
    <div className={`p-4 rounded-lg border transition-all ${
      isComplete ? 'bg-accent/10 border-accent/30' : 'bg-white/5 border-white/10'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-sm ${
          isComplete ? 'bg-accent/20' : 'bg-white/10'
        }`}>
          {icon}
        </div>
        <span className={`text-xs font-black tabular-nums ${
          isComplete ? 'text-accent' : 'text-gray-400'
        }`}>
          {completed}/{total}
        </span>
      </div>

      <h5 className="text-[10px] font-bold uppercase tracking-widest text-white mb-2">
        {title}
      </h5>

      <div className="w-full bg-black/40 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${
            isComplete ? 'bg-accent' : 'bg-accent'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

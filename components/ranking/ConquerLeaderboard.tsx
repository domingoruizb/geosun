import { Trophy } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';

interface RankingEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  colorHue: number;
  cellsOwned: number;
}

interface ConquerLeaderboardProps {
  ranking: RankingEntry[];
  currentUserId: string;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export function ConquerLeaderboard({ ranking, currentUserId }: ConquerLeaderboardProps) {
  if (ranking.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Trophy className="h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-500">Aún no hay celdas conquistadas</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-slate-800">
      {ranking.map((entry, i) => {
        const isMe = entry.userId === currentUserId;
        return (
          <div
            key={entry.userId}
            className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-blue-500/10' : ''}`}
          >
            <span className="w-6 text-center text-sm">
              {i < 3 ? MEDAL[i] : <span className="text-slate-500">{i + 1}</span>}
            </span>
            <Avatar
              username={entry.username}
              avatarUrl={entry.avatarUrl}
              colorHue={entry.colorHue}
              size="sm"
            />
            <span className={`flex-1 truncate text-sm font-medium ${isMe ? 'text-blue-300' : 'text-slate-200'}`}>
              {entry.username}
              {isMe && <span className="ml-1 text-xs text-blue-500">(tú)</span>}
            </span>
            <div className="text-right">
              <span className="text-sm font-bold text-white">{entry.cellsOwned}</span>
              <span className="ml-1 text-xs text-slate-500">celdas</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import Link from 'next/link';
import { Users, ChevronRight } from 'lucide-react';

interface GroupCardProps {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
  colorHue: number;
}

export function GroupCard({ id, name, description, memberCount, colorHue }: GroupCardProps) {
  const accentColor = `hsl(${colorHue} 70% 55%)`;

  return (
    <Link
      href={`/groups/${id}/live`}
      className="group flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700 hover:bg-slate-800/80"
    >
      {/* Color badge */}
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm"
        style={{ backgroundColor: accentColor }}
      >
        {name[0]?.toUpperCase()}
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">{name}</p>
        {description && <p className="mt-0.5 truncate text-sm text-slate-400">{description}</p>}
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <Users className="h-3 w-3" />
          <span>
            {memberCount} {memberCount === 1 ? 'miembro' : 'miembros'}
          </span>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-slate-400" />
    </Link>
  );
}

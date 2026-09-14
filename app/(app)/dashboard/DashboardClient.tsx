'use client';

import { useState } from 'react';
import { Plus, UserPlus, MapPin } from 'lucide-react';
import { GroupCard } from '@/components/groups/GroupCard';
import { CreateGroupModal } from '@/components/groups/CreateGroupModal';
import { JoinGroupModal } from '@/components/groups/JoinGroupModal';

interface Group {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  memberCount: number;
  colorHue: number;
  role: string;
}

interface DashboardClientProps {
  groups: Group[];
}

export function DashboardClient({ groups }: DashboardClientProps) {
  const [modal, setModal] = useState<'create' | 'join' | null>(null);

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col gap-6 overflow-y-auto p-4 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Mis grupos</h1>
        <p className="mt-1 text-sm text-slate-400">
          {groups.length === 0
            ? 'Crea un grupo o únete con un código de invitación.'
            : `${groups.length} grupo${groups.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setModal('create')}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
        >
          <Plus className="h-4 w-4" />
          Crear grupo
        </button>
        <button
          onClick={() => setModal('join')}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-white transition hover:bg-slate-700"
        >
          <UserPlus className="h-4 w-4" />
          Unirme
        </button>
      </div>

      {/* Group list */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-700 py-16">
          <MapPin className="h-10 w-10 text-slate-600" />
          <p className="text-sm text-slate-500">Aún no perteneces a ningún grupo</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              id={g.id}
              name={g.name}
              description={g.description}
              memberCount={g.memberCount}
              colorHue={g.colorHue}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal === 'create' && <CreateGroupModal onClose={() => setModal(null)} />}
      {modal === 'join' && <JoinGroupModal onClose={() => setModal(null)} />}
    </div>
  );
}

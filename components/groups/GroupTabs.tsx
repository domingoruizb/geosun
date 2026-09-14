'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Map, Flame, Swords, Share2 } from 'lucide-react';
import { useState } from 'react';
import { InviteModal } from './InviteModal';

interface GroupTabsProps {
  groupId: string;
  groupName: string;
}

const tabs = [
  { key: 'live', label: 'Live', icon: Map },
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'conquer', label: 'Conquer', icon: Swords },
  { key: 'heat', label: 'Heat', icon: Flame },
];

export function GroupTabs({ groupId, groupName }: GroupTabsProps) {
  const pathname = usePathname();
  const [showInvite, setShowInvite] = useState(false);

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-2">
        {/* Group name */}
        <span className="hidden max-w-[140px] truncate px-2 text-sm font-semibold text-slate-300 sm:block">
          {groupName}
        </span>

        {/* Tabs */}
        <nav className="flex flex-1 sm:flex-none">
          {tabs.map(({ key, label, icon: Icon }) => {
            const href = `/groups/${groupId}/${key}`;
            const active = pathname.endsWith(`/${key}`);
            return (
              <Link
                key={key}
                href={href}
                className={`flex flex-1 flex-col items-center gap-0.5 px-3 py-2.5 text-xs font-medium transition sm:flex-row sm:gap-1.5 sm:px-4 sm:text-sm ${
                  active
                    ? 'border-b-2 border-blue-400 text-blue-400'
                    : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Invite button */}
        <button
          onClick={() => setShowInvite(true)}
          className="ml-2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          title="Invitar al grupo"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {showInvite && (
        <InviteModal groupId={groupId} groupName={groupName} onClose={() => setShowInvite(false)} />
      )}
    </>
  );
}

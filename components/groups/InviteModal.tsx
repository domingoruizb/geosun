'use client';

import { useEffect, useState } from 'react';
import { X, Copy, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface InviteModalProps {
  groupId: string;
  groupName: string;
  onClose: () => void;
}

interface GroupRow {
  invite_code: string;
}

export function InviteModal({ groupId, groupName, onClose }: InviteModalProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (
      supabase
        .from('groups')
        .select('invite_code')
        .eq('id', groupId)
        .single() as unknown as Promise<{ data: GroupRow | null; error: unknown }>
    ).then(({ data }) => setInviteCode(data?.invite_code ?? null));
  }, [groupId]);

  async function handleCopy() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-white">Invitar a {groupName}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-400">
          Comparte este código con tus amigos para que puedan unirse al grupo.
        </p>

        {inviteCode ? (
          <button
            onClick={handleCopy}
            className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-mono text-xl tracking-[0.3em] text-white transition hover:border-slate-600"
          >
            <span>{inviteCode}</span>
            {copied ? (
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <Copy className="h-4 w-4 text-slate-400" />
            )}
          </button>
        ) : (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        )}

        {copied && (
          <p className="mt-2 text-center text-xs text-green-400">¡Código copiado al portapapeles!</p>
        )}
      </div>
    </div>
  );
}

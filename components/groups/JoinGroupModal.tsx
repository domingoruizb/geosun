'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Hash } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface JoinGroupModalProps {
  onClose: () => void;
}

interface JoinResult {
  error?: string;
  group_id?: string;
  group_name?: string;
}

export function JoinGroupModal({ onClose }: JoinGroupModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: rpcError } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: JoinResult | null; error: { message: string } | null }>
    )('join_group_by_invite', { p_invite_code: code.trim() });

    setLoading(false);

    if (rpcError || data?.error) {
      setError(data?.error ?? rpcError?.message ?? 'Error desconocido');
      return;
    }

    router.push(`/groups/${data!.group_id}/live`);
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Unirse a un grupo</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-300">Código de invitación</label>
            <div className="relative">
              <Hash className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="AB12CD34"
                required
                maxLength={8}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pr-4 pl-9 font-mono tracking-widest text-white placeholder-slate-500 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 ring-1 ring-red-500/20">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 px-4 py-3 font-medium text-slate-300 transition hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || code.trim().length < 6}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unirse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

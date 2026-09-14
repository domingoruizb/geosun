'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/Avatar';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProfileClientProps {
  userId: string;
  email: string;
  username: string;
  avatarUrl: string | null;
}

export function ProfileClient({
  userId,
  email,
  username: initialUsername,
  avatarUrl,
}: ProfileClientProps) {
  const [username, setUsername] = useState(initialUsername);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: username.trim() } as never)
      .eq('id', userId);

    setSaving(false);
    if (updateError) {
      setError((updateError as { message: string }).message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-8 p-6">
      <div className="flex flex-col items-center gap-4">
        <Avatar username={username || email} avatarUrl={avatarUrl} colorHue={210} size="lg" />
        <div className="text-center">
          <p className="font-semibold text-white">{username || email}</p>
          <p className="text-sm text-slate-400">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">Nombre de usuario</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="tu_nombre"
            minLength={3}
            maxLength={30}
            required
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 ring-1 ring-red-500/20">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || username.trim() === initialUsername}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            '¡Guardado!'
          ) : (
            <>
              <Save className="h-4 w-4" />
              Guardar cambios
            </>
          )}
        </button>
      </form>
    </div>
  );
}

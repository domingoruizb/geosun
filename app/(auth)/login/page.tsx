'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Mail, Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/30">
          <Mail className="h-8 w-8 text-blue-400" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Revisa tu email</h1>
          <p className="mt-2 text-slate-400">
            Hemos enviado un enlace mágico a{' '}
            <span className="font-medium text-slate-200">{email}</span>
          </p>
        </div>
        <button
          onClick={() => setSent(false)}
          className="text-sm text-slate-500 underline-offset-4 hover:text-slate-300 hover:underline"
        >
          Usar otro email
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/25">
          <MapPin className="h-8 w-8 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Geosun</h1>
          <p className="mt-1 text-sm text-slate-400">Geolocalización social en tiempo real</p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-slate-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-white placeholder-slate-500 ring-offset-slate-950 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 ring-1 ring-red-500/20">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Continuar con Magic Link
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-500">
          Recibirás un enlace de acceso en tu email. Sin contraseñas.
        </p>
      </form>
    </div>
  );
}

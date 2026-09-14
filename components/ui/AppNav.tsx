'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Avatar } from './Avatar';

interface AppNavProps {
  username: string;
  avatarUrl?: string | null;
}

export function AppNav({ username, avatarUrl }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur-sm">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 font-bold text-white">
        <MapPin className="h-5 w-5 text-blue-400" />
        <span>Geosun</span>
      </Link>

      {/* Nav links */}
      <nav className="hidden items-center gap-1 sm:flex">
        <NavLink href="/dashboard" active={isActive('/dashboard')}>
          Grupos
        </NavLink>
        <NavLink href="/profile" active={isActive('/profile')}>
          Perfil
        </NavLink>
      </nav>

      {/* User */}
      <div className="flex items-center gap-2">
        <Avatar username={username} avatarUrl={avatarUrl} size="sm" />
        <button
          onClick={handleSignOut}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

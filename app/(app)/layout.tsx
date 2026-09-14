import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppNav } from '@/components/ui/AppNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = (await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', user.id)
    .single()) as { data: { username: string; avatar_url: string | null } | null; error: unknown };

  return (
    <div className="flex h-dvh flex-col">
      <AppNav username={profile?.username ?? user.email ?? ''} avatarUrl={profile?.avatar_url} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

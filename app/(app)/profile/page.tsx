import { createClient } from '@/lib/supabase/server';
import { ProfileClient } from './ProfileClient';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', user!.id)
    .single();

  return (
    <ProfileClient
      userId={user!.id}
      email={user!.email ?? ''}
      username={profile?.username ?? ''}
      avatarUrl={profile?.avatar_url ?? null}
    />
  );
}

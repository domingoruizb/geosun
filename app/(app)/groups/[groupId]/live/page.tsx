import { createClient } from '@/lib/supabase/server';
import { GeoLiveClient } from './GeoLiveClient';

interface PageProps {
  params: Promise<{ groupId: string }>;
}

interface MemberRow {
  user_id: string;
  color_hue: number;
  profiles: { username: string; avatar_url: string | null } | null;
}

export default async function GeoLivePage({ params }: PageProps) {
  const { groupId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: members } = (await supabase
    .from('group_members')
    .select('user_id, color_hue, profiles(username, avatar_url)')
    .eq('group_id', groupId)) as { data: MemberRow[] | null };

  const membersData = (members ?? []).map((m) => ({
    userId: m.user_id,
    colorHue: m.color_hue,
    username: m.profiles?.username ?? 'Usuario',
    avatarUrl: m.profiles?.avatar_url ?? null,
  }));

  return (
    <GeoLiveClient groupId={groupId} currentUserId={user!.id} members={membersData} />
  );
}

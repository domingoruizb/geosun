import { createClient } from '@/lib/supabase/server';
import { GeoConquerClient } from './GeoConquerClient';

interface PageProps {
  params: Promise<{ groupId: string }>;
}

interface RankingRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  color_hue: number;
  cells_owned: number;
}

interface MemberRow {
  user_id: string;
  color_hue: number;
  profiles: { username: string; avatar_url: string | null } | null;
}

export default async function GeoConquerPage({ params }: PageProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ranking } = (await supabase
    .from('conquer_ranking')
    .select('user_id, username, avatar_url, color_hue, cells_owned')
    .eq('group_id', groupId)
    .order('cells_owned', { ascending: false })
    .limit(10)) as { data: RankingRow[] | null };

  const { data: members } = (await supabase
    .from('group_members')
    .select('user_id, color_hue, profiles(username, avatar_url)')
    .eq('group_id', groupId)) as { data: MemberRow[] | null };

  const initialRanking = (ranking ?? []).map((r) => ({
    userId: r.user_id,
    username: r.username,
    avatarUrl: r.avatar_url,
    colorHue: r.color_hue,
    cellsOwned: r.cells_owned,
  }));

  const membersData = (members ?? []).map((m) => ({
    userId: m.user_id,
    colorHue: m.color_hue,
    username: m.profiles?.username ?? 'Usuario',
    avatarUrl: m.profiles?.avatar_url ?? null,
  }));

  return (
    <GeoConquerClient
      groupId={groupId}
      currentUserId={user!.id}
      initialRanking={initialRanking}
      members={membersData}
    />
  );
}

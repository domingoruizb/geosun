import { createClient } from '@/lib/supabase/server';
import { GeoChatClient } from './GeoChatClient';

interface PageProps {
  params: Promise<{ groupId: string }>;
}

interface MessageRow {
  id: string;
  user_id: string | null;
  type: string;
  content: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
}

interface MemberRow {
  user_id: string;
  color_hue: number;
}

const PAGE_SIZE = 40;

export default async function GeoChatPage({ params }: PageProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: messages } = (await supabase
    .from('messages')
    .select('id, user_id, type, content, created_at, profiles(username, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)) as { data: MessageRow[] | null };

  const { data: members } = (await supabase
    .from('group_members')
    .select('user_id, color_hue')
    .eq('group_id', groupId)) as { data: MemberRow[] | null };

  const colorMap = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.color_hue]));

  const initialMessages = (messages ?? []).reverse().map((m) => ({
    id: m.id,
    userId: m.user_id,
    type: m.type as 'text' | 'system',
    content: m.content,
    createdAt: m.created_at,
    username: m.profiles?.username ?? 'Usuario',
    avatarUrl: m.profiles?.avatar_url ?? null,
    colorHue: m.user_id ? (colorMap[m.user_id] ?? 210) : 210,
  }));

  return (
    <GeoChatClient
      groupId={groupId}
      currentUserId={user!.id}
      initialMessages={initialMessages}
      colorMap={colorMap}
    />
  );
}

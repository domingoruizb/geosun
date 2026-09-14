import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './DashboardClient';

interface MembershipRow {
  color_hue: number;
  role: string;
  groups: { id: string; name: string; description: string | null; invite_code: string } | null;
}

interface MemberCountRow {
  group_id: string;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = (await supabase
    .from('group_members')
    .select('color_hue, role, groups(id, name, description, invite_code)')
    .eq('user_id', user!.id)
    .order('joined_at', { ascending: false })) as { data: MembershipRow[] | null };

  const groupIds = (memberships ?? [])
    .map((m) => m.groups?.id)
    .filter(Boolean) as string[];

  const { data: memberCounts } = (
    groupIds.length
      ? await supabase.from('group_members').select('group_id').in('group_id', groupIds)
      : { data: [] }
  ) as { data: MemberCountRow[] | null };

  const countByGroup = (memberCounts ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.group_id] = (acc[row.group_id] ?? 0) + 1;
    return acc;
  }, {});

  const groups = (memberships ?? [])
    .filter((m) => m.groups)
    .map((m) => ({
      id: m.groups!.id,
      name: m.groups!.name,
      description: m.groups!.description,
      inviteCode: m.groups!.invite_code,
      memberCount: countByGroup[m.groups!.id] ?? 1,
      colorHue: m.color_hue,
      role: m.role,
    }));

  return <DashboardClient groups={groups} />;
}

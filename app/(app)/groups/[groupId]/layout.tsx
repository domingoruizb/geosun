import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { GroupTabs } from '@/components/groups/GroupTabs';

interface GroupLayoutProps {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}

interface MemberRow {
  role: string;
  color_hue: number;
  groups: { name: string } | null;
}

export default async function GroupLayout({ children, params }: GroupLayoutProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: member } = (await supabase
    .from('group_members')
    .select('role, color_hue, groups(name)')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()) as { data: MemberRow | null; error: unknown };

  if (!member) notFound();

  const groupName = member.groups?.name ?? '';

  return (
    <div className="flex h-full flex-col">
      <GroupTabs groupId={groupId} groupName={groupName} />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

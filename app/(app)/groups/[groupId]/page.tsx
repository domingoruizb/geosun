import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ groupId: string }>;
}

export default async function GroupIndexPage({ params }: PageProps) {
  const { groupId } = await params;
  redirect(`/groups/${groupId}/live`);
}

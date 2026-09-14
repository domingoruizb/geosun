import { createClient } from '@/lib/supabase/server';
import { GeoHeatClient } from './GeoHeatClient';

interface PageProps {
  params: Promise<{ groupId: string }>;
}

interface LocationRow {
  geom: string;
}

const MAX_POINTS = 2000;

export default async function GeoHeatPage({ params }: PageProps) {
  const { groupId } = await params;
  const supabase = await createClient();

  const { data: logs } = (await supabase
    .from('location_logs')
    .select('geom')
    .eq('group_id', groupId)
    .order('recorded_at', { ascending: false })
    .limit(MAX_POINTS)) as { data: LocationRow[] | null };

  const points = (logs ?? [])
    .map((row) => {
      const match = row.geom?.toString().match(/POINT\(([^ ]+) ([^ )]+)\)/);
      if (!match) return null;
      return { longitude: parseFloat(match[1]), latitude: parseFloat(match[2]) };
    })
    .filter(Boolean) as { longitude: number; latitude: number }[];

  return <GeoHeatClient groupId={groupId} initialPoints={points} />;
}

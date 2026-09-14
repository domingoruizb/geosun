'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';

interface Message {
  id: string;
  userId: string | null;
  type: 'text' | 'system';
  content: string;
  createdAt: string;
  username: string;
  avatarUrl: string | null;
  colorHue: number;
}

interface RealtimeMessageRow {
  id: string;
  user_id: string | null;
  type: string;
  content: string;
  created_at: string;
}

interface ProfileRow {
  username: string;
  avatar_url: string | null;
}

interface MessageRow {
  id: string;
  user_id: string | null;
  type: string;
  content: string;
  created_at: string;
  profiles: ProfileRow | null;
}

interface GeoChatClientProps {
  groupId: string;
  currentUserId: string;
  initialMessages: Message[];
  colorMap: Record<string, number>;
}

const PAGE_SIZE = 40;

export function GeoChatClient({ groupId, currentUserId, initialMessages, colorMap }: GeoChatClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length === PAGE_SIZE);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`group:${groupId}:messages`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const row = payload.new as RealtimeMessageRow;

          let username = 'Sistema';
          let avatarUrl: string | null = null;

          if (row.user_id) {
            const { data } = (await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', row.user_id)
              .single()) as { data: ProfileRow | null; error: unknown };
            username = data?.username ?? 'Usuario';
            avatarUrl = data?.avatar_url ?? null;
          }

          const newMsg: Message = {
            id: row.id,
            userId: row.user_id,
            type: row.type as 'text' | 'system',
            content: row.content,
            createdAt: row.created_at,
            username,
            avatarUrl,
            colorHue: row.user_id ? (colorMap[row.user_id] ?? 210) : 210,
          };

          setMessages((prev) => [...prev, newMsg]);
          if (row.user_id === currentUserId) {
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, currentUserId, colorMap, supabase]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const oldest = messages[0];
    if (!oldest) return;

    setLoadingMore(true);
    const { data } = (await supabase
      .from('messages')
      .select('id, user_id, type, content, created_at, profiles(username, avatar_url)')
      .eq('group_id', groupId)
      .lt('created_at', oldest.createdAt)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)) as { data: MessageRow[] | null };

    const older = (data ?? []).reverse().map((m) => ({
      id: m.id,
      userId: m.user_id,
      type: m.type as 'text' | 'system',
      content: m.content,
      createdAt: m.created_at,
      username: m.profiles?.username ?? 'Usuario',
      avatarUrl: m.profiles?.avatar_url ?? null,
      colorHue: m.user_id ? (colorMap[m.user_id] ?? 210) : 210,
    }));

    setHasMore(older.length === PAGE_SIZE);
    setMessages((prev) => [...older, ...prev]);
    setLoadingMore(false);
  }, [groupId, messages, loadingMore, hasMore, colorMap, supabase]);

  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  async function sendMessage(content: string) {
    await supabase.from('messages').insert({
      group_id: groupId,
      user_id: currentUserId,
      type: 'text',
      content,
    } as never);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-3">
        <div ref={topRef} className="h-1" />

        {loadingMore && (
          <div className="py-2 text-center text-xs text-slate-500">Cargando mensajes...</div>
        )}

        {!hasMore && messages.length > 0 && (
          <div className="py-2 text-center text-xs text-slate-600">Inicio del chat</div>
        )}

        <div className="flex flex-col gap-1">
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.userId === currentUserId}
              showAvatar={msg.userId !== messages[i - 1]?.userId}
            />
          ))}
        </div>

        <div ref={bottomRef} className="h-1" />
      </div>

      <MessageInput onSend={sendMessage} />
    </div>
  );
}

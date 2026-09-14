import { Avatar } from '@/components/ui/Avatar';

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

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
}

export function MessageBubble({ message, isOwn, showAvatar }: MessageBubbleProps) {
  if (message.type === 'system') {
    return <div className="my-1 text-center text-xs text-slate-500">{message.content}</div>;
  }

  const time = new Date(message.createdAt).toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isOwn) {
    return (
      <div className="flex flex-col items-end gap-0.5 pl-12">
        <div className="max-w-xs rounded-2xl rounded-br-sm bg-blue-500 px-3.5 py-2 text-sm text-white">
          {message.content}
        </div>
        <span className="mr-1 text-[10px] text-slate-500">{time}</span>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 pr-12">
      <div className="w-7 shrink-0">
        {showAvatar && (
          <Avatar
            username={message.username}
            avatarUrl={message.avatarUrl}
            colorHue={message.colorHue}
            size="sm"
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {showAvatar && (
          <span
            className="ml-0.5 text-xs font-medium"
            style={{ color: `hsl(${message.colorHue} 65% 65%)` }}
          >
            {message.username}
          </span>
        )}
        <div className="max-w-xs rounded-2xl rounded-bl-sm bg-slate-800 px-3.5 py-2 text-sm text-slate-100">
          {message.content}
        </div>
        <span className="ml-0.5 text-[10px] text-slate-500">{time}</span>
      </div>
    </div>
  );
}

interface AvatarProps {
  username: string;
  avatarUrl?: string | null;
  colorHue?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' };

export function Avatar({ username, avatarUrl, colorHue = 210, size = 'md', className = '' }: AvatarProps) {
  const initial = username[0]?.toUpperCase() ?? '?';
  const bg = `hsl(${colorHue} 70% 45%)`;

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={username}
        className={`${sizes[size]} rounded-full object-cover ring-2 ring-slate-800 ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizes[size]} inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-slate-800 ${className}`}
      style={{ backgroundColor: bg }}
      aria-label={username}
    >
      {initial}
    </span>
  );
}

const AVATAR_COLORS = ['#7c6dfa', '#3dd68c', '#f5a623', '#4da6ff', '#f05252', '#2dd4bf'];

export function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name = '') {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

export function MemberAvatar({ name = '', size = 28, className = '', title }) {
  const color = getAvatarColor(name);
  const initials = getInitials(name);
  return (
    <div
      data-testid="member-avatar"
      title={title || name}
      className={`flex items-center justify-center rounded-full font-bold font-mono shrink-0 select-none ${className}`}
      style={{
        width: size, height: size,
        background: `${color}22`,
        border: `1.5px solid ${color}55`,
        color,
        fontSize: Math.floor(size * 0.38),
      }}
    >
      {initials}
    </div>
  );
}

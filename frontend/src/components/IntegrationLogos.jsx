// ── Brand logo SVG components for integrations ───────────────────────────────
// Inline SVGs — no external dependencies, no image imports.

export function NotionLogo({ size = 16, style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      style={style}
    >
      <path d="M6.017 4.313l55.333-4.087c6.797-0.583 8.543-0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08 0.193-6.023-0.39-8.16-3.113L3.88 81.98c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 5.437-6.8z" />
    </svg>
  );
}

export function SlackLogo({ size = 16 }) {
  // Slack's official 4-color hashtag mark
  // Each arm of the hashtag is made of 2 rounded rects per color group
  const r = 3.5; // corner radius
  return (
    <svg width={size} height={size} viewBox="0 0 54 54">
      {/* Pink/red — top-left horizontal + anchor circle */}
      <rect x="8"  y="20" width="18" height="6.5" rx={r} fill="#E01E5A" />
      <rect x="8"  y="8"  width="6.5" height="18" rx={r} fill="#E01E5A" />
      <circle cx="11.25" cy="11.25" r="3.5" fill="#E01E5A" />

      {/* Blue — top-right horizontal + anchor circle */}
      <rect x="28" y="20" width="18" height="6.5" rx={r} fill="#36C5F0" />
      <rect x="39.5" y="8" width="6.5" height="18" rx={r} fill="#36C5F0" />
      <circle cx="42.75" cy="11.25" r="3.5" fill="#36C5F0" />

      {/* Green — bottom-left vertical + anchor circle */}
      <rect x="8"  y="27.5" width="6.5" height="18" rx={r} fill="#2EB67D" />
      <rect x="20" y="27.5" width="18" height="6.5"  rx={r} fill="#2EB67D" />
      <circle cx="11.25" cy="42.75" r="3.5" fill="#2EB67D" />

      {/* Yellow — bottom-right vertical + anchor circle */}
      <rect x="39.5" y="27.5" width="6.5" height="18" rx={r} fill="#ECB22E" />
      <rect x="20"   y="39.5" width="18"  height="6.5" rx={r} fill="#ECB22E" />
      <circle cx="42.75" cy="42.75" r="3.5" fill="#ECB22E" />
    </svg>
  );
}

export function CalendarLogo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {/* Calendar body */}
      <rect x="2" y="4" width="20" height="18" rx="2" fill="#ffffff" stroke="#e0e0e0" strokeWidth="0.5" />
      {/* Blue header strip */}
      <rect x="2" y="4" width="20" height="6" rx="2" fill="#4285F4" />
      <rect x="2" y="7" width="20" height="3" fill="#4285F4" />
      {/* Binding dots */}
      <rect x="7"  y="2" width="2" height="4" rx="1" fill="#4285F4" />
      <rect x="15" y="2" width="2" height="4" rx="1" fill="#4285F4" />
      {/* Calendar grid lines (subtle) */}
      <rect x="4" y="13" width="4" height="3" rx="0.5" fill="#4285F4" opacity="0.15" />
      <rect x="10" y="13" width="4" height="3" rx="0.5" fill="#4285F4" opacity="0.15" />
      <rect x="16" y="13" width="4" height="3" rx="0.5" fill="#4285F4" opacity="0.15" />
      {/* Google "G" mark — small, bottom right */}
      <circle cx="18.5" cy="19.5" r="2.8" fill="#4285F4" />
      <path
        d="M19.9 19.5h-1.4v0.9h0.8c-0.07 0.38-0.42 0.65-0.8 0.65a1.05 1.05 0 010-2.1c0.26 0 0.49 0.1 0.67 0.25l0.63-0.63a1.85 1.85 0 10-1.3 3.18 1.85 1.85 0 001.82-2.24z"
        fill="#ffffff"
        transform="scale(0.85) translate(3.8 3.2)"
      />
    </svg>
  );
}

// ── Tiny dot marks for Sidebar status indicator ───────────────────────────────
// Simplified 10×10 versions of each logo mark

export function NotionMark({ connected }) {
  return (
    <svg width="10" height="10" viewBox="0 0 100 100" fill={connected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.15)'}>
      <path d="M6.017 4.313l55.333-4.087c6.797-0.583 8.543-0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08 0.193-6.023-0.39-8.16-3.113L3.88 81.98c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 5.437-6.8z" />
    </svg>
  );
}

export function SlackMark({ connected }) {
  if (!connected) {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10">
        <rect x="1" y="3.5" width="8" height="2.5" rx="1.2" fill="rgba(255,255,255,0.15)" />
        <rect x="3.5" y="1" width="2.5" height="8" rx="1.2" fill="rgba(255,255,255,0.15)" />
      </svg>
    );
  }
  const s = 10 / 54;
  return (
    <svg width="10" height="10" viewBox="0 0 54 54">
      <rect x="8"  y="20" width="18" height="6.5" rx="3" fill="#E01E5A" />
      <rect x="8"  y="8"  width="6.5" height="18" rx="3" fill="#E01E5A" />
      <rect x="28" y="20" width="18" height="6.5" rx="3" fill="#36C5F0" />
      <rect x="39.5" y="8" width="6.5" height="18" rx="3" fill="#36C5F0" />
      <rect x="8"  y="27.5" width="6.5" height="18" rx="3" fill="#2EB67D" />
      <rect x="20" y="27.5" width="18" height="6.5" rx="3" fill="#2EB67D" />
      <rect x="39.5" y="27.5" width="6.5" height="18" rx="3" fill="#ECB22E" />
      <rect x="20"   y="39.5" width="18" height="6.5" rx="3" fill="#ECB22E" />
    </svg>
  );
}

export function CalendarMark({ connected }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24">
      <rect x="2" y="4" width="20" height="18" rx="2" fill={connected ? '#4285F4' : 'rgba(255,255,255,0.15)'} />
      <rect x="2" y="4" width="20" height="5.5" rx="2" fill={connected ? '#1a73e8' : 'rgba(255,255,255,0.08)'} />
      {connected && <rect x="4" y="12" width="16" height="1.5" rx="0.5" fill="rgba(255,255,255,0.4)" />}
      {connected && <rect x="4" y="16" width="10" height="1.5" rx="0.5" fill="rgba(255,255,255,0.4)" />}
    </svg>
  );
}

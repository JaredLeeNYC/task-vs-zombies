import type { Importance } from '../core/types'

/** The gradients the sprites are shaded with. Render it once, anywhere on the page. */
export function SpriteDefs() {
  return (
    <svg className="sprite-defs" aria-hidden="true">
      <defs>
        <radialGradient id="shade-skin" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#d2e6c9" />
          <stop offset="1" stopColor="#84a37b" />
        </radialGradient>
        <linearGradient id="shade-coat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#96724c" />
          <stop offset="1" stopColor="#583e25" />
        </linearGradient>
        <linearGradient id="shade-metal" x1="0" x2="1">
          <stop offset="0" stopColor="#e8edf2" />
          <stop offset="0.45" stopColor="#aab3bd" />
          <stop offset="1" stopColor="#6c7680" />
        </linearGradient>
        <linearGradient id="shade-cone" x1="0" x2="1">
          <stop offset="0" stopColor="#ffb866" />
          <stop offset="1" stopColor="#d6600a" />
        </linearGradient>
        <radialGradient id="shade-sun" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff7b5" />
          <stop offset="1" stopColor="#ffbd14" />
        </radialGradient>
        <radialGradient id="shade-heart" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ff9d8c" />
          <stop offset="1" stopColor="#cc2727" />
        </radialGradient>
      </defs>
    </svg>
  )
}

/** Walks left. Importance picks the headgear: bare, traffic cone, or bucket. */
export function Zombie({ importance }: { importance: Importance }) {
  return (
    <svg viewBox="0 -12 64 96" className="sprite" aria-hidden="true">
      <ellipse cx="31" cy="81" rx="22" ry="3" opacity="0.3" />
      <rect x="24" y="60" width="8" height="18" rx="2" fill="#39456b" />
      <rect x="36" y="60" width="8" height="18" rx="2" fill="#2f3a5c" />
      <ellipse cx="25" cy="80" rx="8" ry="3.5" fill="#3a2a22" />
      <ellipse cx="38" cy="80" rx="8" ry="3.5" fill="#2e211b" />
      <rect x="6" y="41" width="26" height="7" rx="3.5" fill="#8fa98a" transform="rotate(-8 30 45)" />
      <path d="M22 36h22a4 4 0 0 1 4 4v22H18V40a4 4 0 0 1 4-4z" fill="url(#shade-coat)" stroke="#4d3823" strokeWidth="1.5" />
      <path d="M29 36h9l-2 14h-5z" fill="#f2efe6" />
      <path d="M32 38h3l1.5 11-3 4-3-4z" fill="#c0392b" />
      <rect x="2" y="46" width="30" height="8" rx="4" fill="#a3bd9c" stroke="#5d7458" transform="rotate(6 30 50)" />
      <ellipse cx="32" cy="22" rx="15" ry="16" fill="url(#shade-skin)" stroke="#5d7458" strokeWidth="1.5" />
      <circle cx="25" cy="19" r="5.5" fill="#fff" stroke="#444" />
      <circle cx="24" cy="19.5" r="2" fill="#222" />
      <circle cx="37" cy="18" r="4" fill="#fff" stroke="#444" />
      <circle cx="36.3" cy="18.3" r="1.5" fill="#222" />
      <path d="M21 29q8 6 16 1l-1 4q-7 4-14-1z" fill="#4a2b2b" />
      <rect x="25" y="30.5" width="3" height="3" fill="#f5f0dc" />
      <rect x="31" y="31.2" width="3" height="3" fill="#f5f0dc" />
      {importance === 1 && <path d="M24 9q3-6 8-3m-2 0q5-5 9 1" fill="none" stroke="#3d4a39" strokeWidth="1.5" />}
      {importance === 2 && (
        <g stroke="#a8560f" strokeLinejoin="round">
          <path d="M32-10 44 9H20z" fill="url(#shade-cone)" />
          <path d="M27.6-3h8.8l2.5 4H25.1z" fill="#fff" stroke="none" />
          <ellipse cx="32" cy="9.5" rx="15" ry="3.5" fill="url(#shade-cone)" />
        </g>
      )}
      {importance === 3 && (
        <g stroke="#5c646d" strokeLinejoin="round">
          <path d="M19 10 21-9h22l2 19z" fill="url(#shade-metal)" />
          <rect x="16.5" y="8" width="31" height="4.5" rx="2" fill="#7d8791" />
        </g>
      )}
    </svg>
  )
}

export function Sun() {
  return (
    <svg viewBox="0 0 40 40" className="sprite" aria-hidden="true">
      <g stroke="#e59a00" strokeWidth="4" strokeLinecap="round">
        <path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5 32 32M32 8l-3.5 3.5M11.5 28.5 8 32" />
      </g>
      <circle cx="20" cy="20" r="10" fill="url(#shade-sun)" stroke="#e59a00" strokeWidth="2" />
    </svg>
  )
}

export function Heart() {
  return (
    <svg viewBox="0 0 40 40" className="sprite" aria-hidden="true">
      <path
        d="M20 35C4 24 3 13 9 8c5-4 9-1 11 3 2-4 6-7 11-3 6 5 5 16-11 27z"
        fill="url(#shade-heart)"
        stroke="#8f1717"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <ellipse cx="13" cy="13" rx="3.5" ry="2.2" fill="#fff" opacity="0.6" transform="rotate(-30 13 13)" />
    </svg>
  )
}

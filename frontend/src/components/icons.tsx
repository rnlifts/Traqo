import React from 'react';

type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const GridIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const DumbbellIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M6.5 6.5l11 11" />
    <path d="M4 9l3-3M20 6l-3 3M6 20l3-3M15 18l3 3" />
    <rect x="1.5" y="7.5" width="4" height="4" rx="1" />
    <rect x="18.5" y="12.5" width="4" height="4" rx="1" />
    <rect x="7.5" y="1.5" width="4" height="4" rx="1" transform="rotate(45 9.5 3.5)" />
  </svg>
);

export const ClipboardIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
    <path d="M9 11h6M9 15h6" />
  </svg>
);

export const HistoryIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l3 2" />
    <path d="M5 3l-2 3M19 3l2 3" />
  </svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const ArrowLeftIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const SaveIcon: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M5 3h11l4 4v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
    <path d="M8 3v6h8V3M8 21v-6h8v6" />
  </svg>
);

export const InfoIcon: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

export const LogoutIcon: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const PlayIcon: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg {...base(size)} className={className} style={style} fill="currentColor" stroke="none">
    <path d="M6 4l12 8-12 8V4z" />
  </svg>
);

export const UserIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 20, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M18 7l-.75 12.5A2 2 0 0 1 15.26 21H8.74a2 2 0 0 1-1.99-1.5L6 7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const TargetIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.5" fill="currentColor" />
  </svg>
);

export const NoteIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M8 13h8M8 17h5" />
  </svg>
);

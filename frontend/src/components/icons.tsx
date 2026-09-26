import type { SVGProps } from 'react'

export type IconName = 'search' | 'sun' | 'moon' | 'bell' | 'chevron' | 'close' | 'settings' | 'database' | 'alert' | 'building' | 'sparkles' | 'users' | 'sliders' | 'server' | 'newspaper' | 'globe' | 'landmark'

const paths: Record<IconName, string[]> = {
  search: ['m21 21-4.5-4.5', 'M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  moon: ['M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  chevron: ['m9 5 7 7-7 7'],
  close: ['m6 6 12 12M6 18 18 6'],
  settings: ['m9 3-.5 2-2 .9-1.9-.6-2 3.4 1.5 1.4v2.4l-1.5 1.4 2 3.4 1.9-.6 2 .9.5 2h4l.5-2 2-.9 1.9.6 2-3.4-1.5-1.4v-2.4l1.5-1.4-2-3.4-1.9.6-2-.9-.5-2Z', 'M15 11.3a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  database: ['M20 5c0 2-16 2-16 0s16-2 16 0v14c0 2-16 2-16 0V5', 'M4 12c0 2 16 2 16 0'],
  alert: ['m12 3 10 18H2L12 3Z', 'M12 9v5m0 3v.01'],
  building: ['M3 21h18', 'M6 21V5l6-2 6 2v16', 'M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01'],
  sparkles: ['m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z', 'm19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z', 'm5 13 .7 2.3L8 16l-2.3.7L5 19l-.7-2.3L2 16l2.3-.7L5 13Z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'],
  sliders: ['M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3', 'M1 14h6M9 8h6m2 8h6'],
  server: ['M4 4h16v6H4zM4 14h16v6H4z', 'M8 7h.01M8 17h.01'],
  newspaper: ['M4 5h13v14H4z', 'M17 8h3v11h-3M7 9h7M7 13h7M7 16h4'],
  globe: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20'],
  landmark: ['M3 10h18L12 3 3 10Z', 'M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M2 18h20'],
}

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name].map((d) => <path key={d} d={d} />)}</svg>
}

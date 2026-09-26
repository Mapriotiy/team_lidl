import type { SVGProps } from 'react'

type IconName = 'search' | 'sun' | 'moon' | 'bell' | 'chevron' | 'close' | 'settings' | 'database' | 'alert'

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
}

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name].map((d) => <path key={d} d={d} />)}</svg>
}

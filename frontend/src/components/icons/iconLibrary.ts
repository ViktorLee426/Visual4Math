export interface IconDef {
  name: string;
  svg: string; // raw svg markup without xml header
}

// Minimal open-style SVGs for prototyping (simplified shapes)
export const iconLibrary: IconDef[] = [
  {
    name: 'basketball',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="46" fill="#f59e0b" stroke="#000" stroke-width="4"/><path d="M50 4 v92 M4 50 h92 M20 20 q30 30 60 60 M20 80 q30-30 60-60" stroke="#000" stroke-width="4" fill="none"/></svg>'
  },
  {
    name: 'scissors',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="70" r="12" fill="#fff" stroke="#000" stroke-width="3"/><circle cx="45" cy="70" r="12" fill="#fff" stroke="#000" stroke-width="3"/><path d="M30 60 L70 20" stroke="#000" stroke-width="4"/><path d="M40 60 L80 20" stroke="#000" stroke-width="4"/></svg>'
  },
  {
    name: 'glue stick',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="35" y="20" width="30" height="60" rx="6" fill="#fde68a" stroke="#000" stroke-width="3"/><rect x="35" y="15" width="30" height="10" rx="3" fill="#60a5fa" stroke="#000" stroke-width="3"/></svg>'
  },
  {
    name: 'pencil',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M20 80 L80 20 L90 30 L30 90 Z" fill="#f59e0b" stroke="#000" stroke-width="3"/><path d="M20 80 L30 90" stroke="#000" stroke-width="3"/><path d="M80 20 L90 30" stroke="#000" stroke-width="3"/></svg>'
  },
  {
    name: 'book',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="20" width="64" height="60" rx="6" fill="#bfdbfe" stroke="#000" stroke-width="3"/><path d="M50 20 v60" stroke="#000" stroke-width="3"/></svg>'
  },
  {
    name: 'cube',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="25" width="50" height="50" fill="#fff" stroke="#000" stroke-width="3"/><path d="M25 25 L50 10 L75 25 L50 40 Z" fill="#e5e7eb" stroke="#000" stroke-width="3"/><path d="M75 25 V75 L50 90 V40" fill="#d1d5db" stroke="#000" stroke-width="3"/></svg>'
  },
  {
    name: 'cube red',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="25" width="50" height="50" fill="#fecaca" stroke="#000" stroke-width="3"/><path d="M25 25 L50 10 L75 25 L50 40 Z" fill="#fca5a5" stroke="#000" stroke-width="3"/><path d="M75 25 V75 L50 90 V40" fill="#f87171" stroke="#000" stroke-width="3"/></svg>'
  },
  {
    name: 'cube blue',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="25" width="50" height="50" fill="#bfdbfe" stroke="#000" stroke-width="3"/><path d="M25 25 L50 10 L75 25 L50 40 Z" fill="#93c5fd" stroke="#000" stroke-width="3"/><path d="M75 25 V75 L50 90 V40" fill="#60a5fa" stroke="#000" stroke-width="3"/></svg>'
  },
  {
    name: 'cube green',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="25" width="50" height="50" fill="#bbf7d0" stroke="#000" stroke-width="3"/><path d="M25 25 L50 10 L75 25 L50 40 Z" fill="#86efac" stroke="#000" stroke-width="3"/><path d="M75 25 V75 L50 90 V40" fill="#4ade80" stroke="#000" stroke-width="3"/></svg>'
  },
  {
    name: 'ruler',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="40" width="70" height="20" rx="4" fill="#fde68a" stroke="#000" stroke-width="3"/><path d="M25 40 v20 M35 40 v10 M45 40 v20 M55 40 v10 M65 40 v20" stroke="#000" stroke-width="3"/></svg>'
  },
  {
    name: 'bag',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="35" width="60" height="45" rx="8" fill="#93c5fd" stroke="#000" stroke-width="3"/><path d="M35 35 q15-20 30 0" fill="none" stroke="#000" stroke-width="3"/></svg>'
  },
  {
    name: 'apple',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 20c10-10 22-8 22-8s-3 10-12 14c0 0 16-2 20 16 2 9-2 19-8 26-6 7-13 10-22 10s-16-3-22-10c-6-7-10-17-8-26 4-18 20-16 20-16-9-4-12-14-12-14s12-2 22 8z" fill="#ef4444" stroke="#000" stroke-width="3"/><path d="M52 14 c4-6 10-8 16-6" stroke="#16a34a" stroke-width="3" fill="none"/></svg>'
  },
  {
    name: 'ice cream',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 20c15 0 26 10 26 22 0 5-2 9-5 12H29c-3-3-5-7-5-12 0-12 11-22 26-22z" fill="#fde68a" stroke="#000" stroke-width="3"/><path d="M35 54 l15 36 15-36z" fill="#f59e0b" stroke="#000" stroke-width="3"/></svg>'
  },
  {
    name: 'cake',
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="50" width="70" height="30" rx="6" fill="#fde68a" stroke="#000" stroke-width="3"/><path d="M15 50 q10 10 20 0 t20 0 t20 0" fill="#fca5a5" stroke="#000" stroke-width="3"/><rect x="45" y="30" width="10" height="20" fill="#fff" stroke="#000" stroke-width="3"/><circle cx="50" cy="28" r="3" fill="#f87171"/></svg>'
  }
];



export type Profile = {
  name: 'high' | 'low';
  n: number;
  worldSize: number;
  droplets: number;
  trees: number;
  tex: number;
  shadowMap: number;
};

export const PROFILES: Record<'high' | 'low', Profile> = {
  high: { name: 'high', n: 1024, worldSize: 120, droplets: 600000, trees: 26000, tex: 2048, shadowMap: 4096 },
  low: { name: 'low', n: 512, worldSize: 120, droplets: 150000, trees: 9000, tex: 1024, shadowMap: 2048 },
};

// Reduced quality on small screens or weak CPUs; ?quality=low|high overrides.
export function pickProfile(): Profile {
  const q = new URLSearchParams(window.location.search).get('quality');
  if (q === 'low' || q === 'high') return PROFILES[q];
  const small = window.matchMedia('(max-width: 899px)').matches;
  const weak = (navigator.hardwareConcurrency || 4) <= 4;
  if (small || weak) return PROFILES.low;
  return PROFILES.high;
}

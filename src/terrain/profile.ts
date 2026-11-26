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

export type ProfileInput = {
  width: number;
  cores: number;
  coarsePointer: boolean;
  deviceMemory: number | undefined;
  queryOverride: string | null;
};

// Reduced quality on small screens, touch devices or weak hardware; ?quality=low|high overrides.
export function chooseProfile(i: ProfileInput): Profile {
  if (i.queryOverride === 'low' || i.queryOverride === 'high') return PROFILES[i.queryOverride];
  if (i.width <= 899 || i.cores <= 4 || i.coarsePointer || (i.deviceMemory !== undefined && i.deviceMemory <= 4)) {
    return PROFILES.low;
  }
  return PROFILES.high;
}

export function pickProfile(): Profile {
  return chooseProfile({
    width: window.innerWidth,
    cores: navigator.hardwareConcurrency || 4,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    queryOverride: new URLSearchParams(window.location.search).get('quality'),
  });
}

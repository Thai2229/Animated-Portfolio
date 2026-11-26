import { describe, expect, it } from 'vitest';
import { chooseProfile } from '../src/terrain/profile';

const base = { width: 1440, cores: 8, coarsePointer: false, deviceMemory: undefined, queryOverride: null };

describe('chooseProfile', () => {
  it('iPad-like touch device is low', () => {
    expect(chooseProfile({ ...base, width: 1024, coarsePointer: true }).name).toBe('low');
  });
  it('desktop is high', () => {
    expect(chooseProfile(base).name).toBe('high');
  });
  it('low-core laptop is low', () => {
    expect(chooseProfile({ ...base, cores: 4 }).name).toBe('low');
  });
  it('small width is low', () => {
    expect(chooseProfile({ ...base, width: 800 }).name).toBe('low');
  });
  it('deviceMemory 2 is low, 8 is high', () => {
    expect(chooseProfile({ ...base, deviceMemory: 2 }).name).toBe('low');
    expect(chooseProfile({ ...base, deviceMemory: 8 }).name).toBe('high');
  });
  it('query override wins', () => {
    expect(chooseProfile({ ...base, deviceMemory: 2, queryOverride: 'high' }).name).toBe('high');
    expect(chooseProfile({ ...base, queryOverride: 'low' }).name).toBe('low');
    expect(chooseProfile({ ...base, queryOverride: 'bogus' }).name).toBe('high');
  });
});

import { describe, it, expect } from 'vitest';
import { siteUrl } from '@/content/siteUrl';

describe('siteUrl', () => {
  it('prefers the production url', () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'a.vercel.app', VERCEL_URL: 'b.vercel.app' })).toBe('https://a.vercel.app');
  });
  it('falls back to the deployment url', () => {
    expect(siteUrl({ VERCEL_URL: 'b.vercel.app' })).toBe('https://b.vercel.app');
  });
  it('falls back to localhost', () => {
    expect(siteUrl({})).toBe('http://localhost:3000');
  });
});

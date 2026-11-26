import { describe, it, expect } from 'vitest';
import { SECTS } from '@/content/sects';

const bySlugUrl = (url: string) => SECTS.find((s) => s.liveUrl === url);

describe('SECTS', () => {
  it('has exactly 3 sects', () => {
    expect(SECTS).toHaveLength(3);
  });

  it('has unique slugs', () => {
    expect(new Set(SECTS.map((s) => s.slug)).size).toBe(3);
  });

  it('uses each site exactly once', () => {
    expect(SECTS.map((s) => s.site).sort()).toEqual(['lake', 'ledge', 'valley']);
  });

  it('uses numerals 一 二 三 once each', () => {
    expect(SECTS.map((s) => s.numeral).sort()).toEqual(['一', '三', '二'].sort());
  });

  it('has non-empty text fields and a stack', () => {
    for (const s of SECTS) {
      expect(s.slug.length).toBeGreaterThan(0);
      expect(s.sectName.length).toBeGreaterThan(0);
      expect(s.project.length).toBeGreaterThan(0);
      expect(s.tagline.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.stack.length).toBeGreaterThan(0);
    }
  });

  it('has https live urls', () => {
    for (const s of SECTS) {
      expect(s.liveUrl.startsWith('https://')).toBe(true);
    }
  });

  it('maps veryshrt to the ledge', () => {
    const s = bySlugUrl('https://veryshrt.vercel.app');
    expect(s).toBeDefined();
    expect(s?.site).toBe('ledge');
    expect(s?.sectName).toBe('Swift Wind Pagoda');
  });

  it('maps the Productivity App to the valley', () => {
    const s = bySlugUrl('https://productivityappthai.vercel.app');
    expect(s).toBeDefined();
    expect(s?.site).toBe('valley');
    expect(s?.sectName).toBe('Hundred Disciplines Hall');
  });

  it('maps the 2D Physics Engine to the lake', () => {
    const s = bySlugUrl('https://physicsenginethai.vercel.app');
    expect(s).toBeDefined();
    expect(s?.site).toBe('lake');
    expect(s?.sectName).toBe('Heavenly Balance Temple');
  });

  it('has github urls on github.com when present', () => {
    for (const s of SECTS) {
      if (s.githubUrl !== undefined) {
        expect(s.githubUrl.startsWith('https://github.com/')).toBe(true);
      }
    }
  });
});

import type { SiteKey } from '@/terrain/layout';

export type Sect = {
  slug: string;
  site: SiteKey;
  numeral: string;
  roman: string;
  sectName: string;
  project: string;
  blurb: string;
  tagline: string;
  description: string;
  stack: string[];
  liveUrl: string;
  githubUrl: string;
};

export const SECTS: Sect[] = [
  {
    slug: 'veryshrt',
    site: 'ledge',
    numeral: '一',
    roman: 'I',
    sectName: 'Swift Wind Pagoda',
    project: 'veryshrt',
    blurb: 'URL shortener · 6,000 redirects/s',
    tagline: 'A URL shortener built to stay fast under load.',
    description:
      'Load tested with k6: 1.7 ms p95 at 2,000 redirects per second, and 37.5 ms p95 at 6,000 redirects per second with zero errors.',
    stack: ['TypeScript', 'Fastify', 'PostgreSQL', 'Redis', 'Docker'],
    liveUrl: 'https://veryshrt.vercel.app',
    githubUrl: 'https://github.com/Thai2229/URL-Shortener',
  },
  {
    slug: 'productivity-app',
    site: 'valley',
    numeral: '二',
    roman: 'II',
    sectName: 'Hundred Disciplines Hall',
    project: 'Productivity App',
    blurb: 'Pomodoro, jobs, habits, roadmaps',
    tagline: 'One place for focus, job hunting, habits and learning.',
    description:
      'A Pomodoro timer, job tracker, habit tracker and skill roadmaps. Sign in with Google OAuth 2.0 or email verification codes, with Cloudflare Turnstile guarding the forms.',
    stack: ['React', 'TypeScript', 'Express', 'PostgreSQL', 'Prisma'],
    liveUrl: 'https://productivityappthai.vercel.app',
    githubUrl: 'https://github.com/Thai2229/Productivity-App',
  },
  {
    slug: 'physics-engine',
    site: 'lake',
    numeral: '三',
    roman: 'III',
    sectName: 'Heavenly Balance Temple',
    project: '2D Physics Engine',
    blurb: 'C++ rigid bodies in WebAssembly',
    tagline: 'A rigid-body engine written in C++ and run in the browser.',
    description:
      'Compiled to WebAssembly and shown in a Next.js demo: a robotic arm, a double pendulum, Newton’s cradle, a rope bridge and a live energy chart.',
    stack: ['C++', 'WebAssembly', 'Next.js'],
    liveUrl: 'https://physicsenginethai.vercel.app',
    githubUrl: 'https://github.com/Thai2229/Physics-Engine',
  },
];

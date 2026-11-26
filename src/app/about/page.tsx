import Link from 'next/link';
import { SECTS } from '@/content/sects';

export const metadata = { title: 'About · Thai Van Le' };

export default function About() {
  return (
    <main className="doc">
      <Link href="/" className="home">← Back to the valley</Link>
      <h1>About</h1>
      <p>I am Thai Van Le, a Math-CS student at UC San Diego. This site is a portfolio built to show three of my projects and to try out three.js. Each project is guarded by one sect in the valley.</p>
      <p>The valley is generated in your browser every time the page loads. A Web Worker builds the terrain from simplex noise and a ridged multifractal, runs hydraulic erosion, cuts terraces, bakes shadows into the heightmap and places the pines as instanced meshes. It is rendered with react-three-fiber, and the site is built with Next.js.</p>
      <p>The source for each project:</p>
      <ul className="plain-links">
        {SECTS.map((s) => (
          <li key={s.slug}>
            <a href={s.githubUrl} target="_blank" rel="noopener noreferrer">{s.project}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}

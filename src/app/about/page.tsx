import Link from 'next/link';

export const metadata = { title: 'About · Thai Van Le' };

export default function About() {
  return (
    <main className="doc">
      <Link href="/" className="home">← Thai Van Le</Link>
      <h1>About</h1>
      <p>I am a software engineer studying at UC San Diego. This page is a placeholder; a fuller story is coming.</p>
    </main>
  );
}

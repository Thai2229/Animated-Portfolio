import Link from 'next/link';

export const metadata = { title: 'Résumé · Thai Van Le' };

export default function Resume() {
  return (
    <main className="doc">
      <Link href="/" className="home">← Thai Van Le</Link>
      <h1>Résumé</h1>
      <p>This page is a placeholder; the résumé will be published here.</p>
    </main>
  );
}

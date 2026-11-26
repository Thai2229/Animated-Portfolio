import { Nav } from "./Nav";

export function Stub({ title }: { title: string }) {
  return (
    <>
      <div className="scan" />
      <Nav />
      <main className="hero stub">
        <p className="mono eyebrow">{title}</p>
        <h1>Coming soon.</h1>
        <p>This page is still being built. The planets on the home page are the best look at my work for now.</p>
      </main>
    </>
  );
}

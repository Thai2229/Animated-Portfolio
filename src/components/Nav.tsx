import Link from "next/link";

const links = [
  { href: "/work", label: "Work" },
  { href: "/experience", label: "Experience" },
  { href: "/about", label: "About" },
  { href: "/resume", label: "Résumé ↗" },
];

export function Nav() {
  return (
    <nav>
      <Link href="/" className="logo" aria-label="Thai Van Le, home">
        <div className="m">TVL</div>
        <div>
          <b>THAI VAN LE</b>
          <span className="mono">SOFTWARE ENGINEER</span>
        </div>
      </Link>
      <ul className="mono">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

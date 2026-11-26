import { projects } from "../projects";

// Plain links to the live sites: the phone layout, and the no-JavaScript fallback.
export function ProjectList({ className }: { className: string }) {
  return (
    <ul className={`plist ${className}`}>
      {projects.map((p, i) => (
        <li key={p.id}>
          <a href={p.url} target="_blank" rel="noopener noreferrer">
            <span className="n mono">{String(i + 1).padStart(2, "0")}</span>
            <span className="name">{p.name}</span>
            <span className="s mono">{p.subtitle}</span>
            <span className="go mono">Open ↗</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

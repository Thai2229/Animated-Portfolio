import { SECTS } from '../content/sects';

export function ProjectLinks() {
  return (
    <ul className="plain-links">
      {SECTS.map((s) => (
        <li key={s.slug}>
          <a href={s.liveUrl} target="_blank" rel="noopener noreferrer">{s.project}</a> · {s.tagline}
        </li>
      ))}
    </ul>
  );
}

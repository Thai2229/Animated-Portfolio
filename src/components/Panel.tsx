'use client';

import { useEffect, useRef } from 'react';
import type { Sect } from '../content/sects';

export function Panel({ sect, onClose }: { sect: Sect; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus();
  }, [sect]);

  // keep Tab inside the dialog
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = ref.current?.querySelectorAll<HTMLElement>('button, a[href]');
    if (!items || items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Tab trap on the dialog container
    <aside className="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title" ref={ref} onKeyDown={trap}>
      <button type="button" className="back" onClick={onClose}>← Back to the valley</button>
      <p className="k"><i>{sect.numeral}</i>Sect {sect.roman} · {sect.sectName}</p>
      <h2 id="panel-title">{sect.project}</h2>
      <p className="tagline">{sect.tagline}</p>
      <p className="desc">{sect.description}</p>
      <ul className="chips" aria-label="Stack">
        {sect.stack.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div className="actions">
        <a className="primary" href={sect.liveUrl} target="_blank" rel="noopener noreferrer">Open live site ↗</a>
        <a className="secondary" href={sect.githubUrl} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
      </div>
    </aside>
  );
}

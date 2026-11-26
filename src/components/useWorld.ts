import { useEffect, useState } from 'react';
import type { Profile } from '../terrain/profile';
import type { WorldData } from '../terrain/world';

export type WorldState =
  | { status: 'loading'; stage: string; fraction: number }
  | { status: 'ready'; world: WorldData }
  | { status: 'error'; message: string };

// Generates the terrain once, off the main thread, reporting progress. Nothing is cached.
export function useWorld(profile: Profile | null): WorldState {
  const [state, setState] = useState<WorldState>({ status: 'loading', stage: 'Gathering the clouds', fraction: 0 });
  useEffect(() => {
    if (!profile) return;
    const started = performance.now();
    let worker: Worker;
    try {
      worker = new Worker(new URL('../terrain/worker.ts', import.meta.url), { type: 'module' });
    } catch (err) {
      queueMicrotask(() => setState({ status: 'error', message: String(err) }));
      return;
    }
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'progress') {
        setState({ status: 'loading', stage: m.stage, fraction: m.f });
      } else if (m.type === 'done') {
        document.documentElement.dataset.worldMs = String(Math.round(performance.now() - started));
        setState({ status: 'ready', world: m.world });
        worker.terminate();
      } else {
        setState({ status: 'error', message: m.message });
        worker.terminate();
      }
    };
    worker.onerror = (e) => {
      setState({ status: 'error', message: e.message });
      worker.terminate();
    };
    worker.postMessage(profile);
    return () => worker.terminate();
  }, [profile]);
  return state;
}

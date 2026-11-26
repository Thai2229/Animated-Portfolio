import { buildWorld } from './world';
import type { Profile } from './profile';

type Ctx = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<Profile>) => void) | null;
};
const ctx = self as unknown as Ctx;

ctx.onmessage = (e) => {
  try {
    const world = buildWorld(e.data, (stage, f) => ctx.postMessage({ type: 'progress', stage, f }));
    ctx.postMessage({ type: 'done', world }, [
      world.heights.buffer, world.albedo.buffer, world.treeMatrices.buffer, world.treeHsl.buffer,
      world.rock.buffer, world.rockNoise.buffer, world.grassPos.buffer, world.grassRnd.buffer,
    ]);
  } catch (err) {
    ctx.postMessage({ type: 'error', message: String(err) });
  }
};

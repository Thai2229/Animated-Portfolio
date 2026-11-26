"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene, type LabelRefs } from "./Scene";
import { SLOTS, KIND_LABEL } from "../layout";
import { projects } from "../projects";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export function Portfolio() {
  const [hover, setHover] = useState<string | null>(null);
  const labels = useRef<LabelRefs>({ tags: [], leads: [] });
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  let frameloop: "always" | "demand" = "always";
  if (reduced) frameloop = "demand";

  return (
    <>
      <div className="stage" aria-hidden="true">
        <Canvas key={frameloop} frameloop={frameloop} dpr={[1, 2]} flat camera={{ position: [0, 0, 20], fov: 40, near: 0.1, far: 400 }} gl={{ antialias: false }}>
          <Scene reduced={reduced} hover={hover} setHover={setHover} labels={labels} />
        </Canvas>
      </div>
      <div className="scan" />
      <div className="labels">
        {projects.map((p, i) => {
          if (!SLOTS[i]) return null;
          let cls = "tag";
          if (hover === p.id) cls = "tag on";
          return (
            <div key={p.id}>
              <div className="lead" ref={(el) => { labels.current.leads[i] = el; }} />
              <a
                className={cls}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                ref={(el) => { labels.current.tags[i] = el; }}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.id)}
                onBlur={() => setHover(null)}
              >
                <div className="n">{String(i + 1).padStart(2, "0")} · {KIND_LABEL[p.planet]}</div>
                <div className="t">{p.name}</div>
                <div className="s">{p.subtitle} · {p.stack}</div>
                <div className="go">Open live site ↗</div>
              </a>
            </div>
          );
        })}
      </div>
    </>
  );
}

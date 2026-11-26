import { describe, expect, it } from "vitest";
import { projects } from "../src/projects";

describe("projects", () => {
  it("lists the three shipped projects in order", () => {
    expect(projects.map((p) => p.planet)).toEqual(["mars", "earth", "giant"]);
    expect(projects.map((p) => p.url)).toEqual([
      "https://veryshrt.vercel.app",
      "https://productivityappthai.vercel.app",
      "https://physicsenginethai.vercel.app",
    ]);
  });

  it("has complete, unique, https entries", () => {
    const ids = new Set(projects.map((p) => p.id));
    expect(ids.size).toBe(projects.length);
    for (const p of projects) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.subtitle.length).toBeGreaterThan(0);
      expect(p.stack.length).toBeGreaterThan(0);
      expect(p.url.startsWith("https://")).toBe(true);
      if (p.github !== undefined) {
        expect(p.github.startsWith("https://github.com/")).toBe(true);
      }
    }
  });
});

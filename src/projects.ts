// Adding a project is a data change: append an entry here and it gets a planet slot, a label and a list link.
export type PlanetKind = "mars" | "earth" | "giant";

export type Project = {
  id: string;
  name: string;
  subtitle: string;
  stack: string;
  url: string;
  github?: string;
  planet: PlanetKind;
};

export const projects: Project[] = [
  {
    id: "veryshrt",
    name: "veryshrt",
    subtitle: "URL shortener",
    stack: "1.7 ms p95",
    url: "https://veryshrt.vercel.app",
    planet: "mars",
  },
  {
    id: "productivity",
    name: "Productivity App",
    subtitle: "Pomodoro, jobs, habits",
    stack: "Web app",
    url: "https://productivityappthai.vercel.app",
    planet: "earth",
  },
  {
    id: "physics",
    name: "2D Physics Engine",
    subtitle: "Orbits and collisions",
    stack: "C++ to WebAssembly",
    url: "https://physicsenginethai.vercel.app",
    planet: "giant",
  },
];

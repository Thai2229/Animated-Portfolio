import { Nav } from "../components/Nav";
import { Portfolio } from "../components/Portfolio";
import { ProjectList } from "../components/ProjectList";

export default function Home() {
  return (
    <>
      <Portfolio />
      <Nav />
      <main className="hero">
        <h1>
          I build fast software,
          <br />
          then I go surfing.
        </h1>
        <p>
          Math-CS at UC San Diego. Every planet here is something I shipped, so click one to open it live. The tabby on the silver board is my cat.
        </p>
        <ProjectList className="phone" />
        <noscript>
          <ProjectList className="always" />
        </noscript>
      </main>
      <div className="foot mono">
        <span>San Diego · 32.88° N</span>
        <span>EN</span>
      </div>
    </>
  );
}

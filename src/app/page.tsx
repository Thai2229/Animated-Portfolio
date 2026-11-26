import { Experience } from '../components/Experience';
import { ProjectLinks } from '../components/ProjectLinks';

export default function Home() {
  return (
    <main>
      <Experience />
      <noscript>
        <div className="fallback">
          <h2>Three sects, three things I built.</h2>
          <p>The interactive valley needs JavaScript. Here are the projects:</p>
          <ProjectLinks />
        </div>
      </noscript>
    </main>
  );
}

import Link from "next/link";

import { Badge, LinkButton, Panel } from "@/components/ui";
import { listProjects } from "@/lib/server/projects";

function relativeDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const projects = await listProjects();

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-8 md:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-8 md:p-10">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-dim)]">
            ChipVoice Studio
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-tight text-[var(--text-main)] md:text-6xl">
            A clean local studio for turning manuscript pages into narrated chapters.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--text-soft)]">
            V1 keeps the scope tight: import text, shape a house narrator, generate real WAV narration, build an annotated performance script for author-read sessions, record booth takes locally, preview chapters, add simple explicit SFX cues, and export finished audio.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <LinkButton href="/projects/new">Create a new project</LinkButton>
          </div>
        </Panel>

        <Panel className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">
                Current focus
              </p>
              <h2 className="mt-3 font-serif text-3xl">One stable workflow</h2>
            </div>
            <Badge>Local only</Badge>
          </div>
          <div className="mt-6 grid gap-4 text-sm leading-7 text-[var(--text-soft)]">
            <p>1. Create a project and pick a Windows narrator voice.</p>
            <p>2. Paste or upload a manuscript and parse it into chapters and sentences.</p>
            <p>3. Generate an annotated script, review speakers and cues, then step into booth mode for author-read takes.</p>
            <p>4. Edit sentence text, pace, pauses, and pronunciations, then generate chapter previews or export WAV files and a zip bundle.</p>
          </div>
        </Panel>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Projects</p>
            <h2 className="mt-2 font-serif text-3xl">Dashboard</h2>
          </div>
          <Badge>{projects.length} active</Badge>
        </div>

        {projects.length === 0 ? (
          <Panel className="p-10 text-center">
            <h3 className="font-serif text-3xl">No projects yet</h3>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--text-soft)]">
              Start with a manuscript and a house narrator voice. The studio will keep everything in a clear local project folder under <code>data/projects</code>.
            </p>
            <div className="mt-6">
              <LinkButton href="/projects/new">Create your first project</LinkButton>
            </div>
          </Panel>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Panel className="h-full p-6 transition hover:-translate-y-1 hover:border-[var(--line-strong)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">
                        {project.author || "Unknown author"}
                      </p>
                      <h3 className="mt-2 font-serif text-3xl">{project.title}</h3>
                    </div>
                    <Badge>{project.chapterCount} chapters</Badge>
                  </div>
                  <div className="mt-6 grid gap-3 text-sm text-[var(--text-soft)]">
                    <div className="flex items-center justify-between">
                      <span>Sentence audio</span>
                      <span>
                        {project.generatedSentences}/{project.totalSentences}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Chapter previews</span>
                      <span>
                        {project.generatedChapters}/{project.totalChapters}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Last updated</span>
                      <span>{relativeDate(project.updatedAt)}</span>
                    </div>
                  </div>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

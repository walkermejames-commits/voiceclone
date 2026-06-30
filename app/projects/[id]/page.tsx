import { notFound } from "next/navigation";

import { ProjectStudio } from "@/components/project-studio";
import { Badge, LinkButton, Panel } from "@/components/ui";
import { getNarratorStatus, getProject } from "@/lib/server/projects";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await getProject(id).catch(() => null);
  if (!project) {
    notFound();
  }

  const narratorStatus = await getNarratorStatus();

  return (
    <main className="mx-auto max-w-[1720px] px-6 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LinkButton href="/" tone="ghost">Dashboard</LinkButton>
          <Badge>{project.narrator.provider}</Badge>
        </div>
        <p className="text-sm text-[var(--text-dim)]">
          Project files live in <code>data/projects/{project.id}</code>, with annotated scripts under <code>annotated-script</code> and booth takes under <code>recordings</code>
        </p>
      </div>
      {!narratorStatus.ok ? (
        <Panel className="mb-6 border-yellow-500/40 bg-yellow-950/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-yellow-200">Narrator setup needed</p>
              <h2 className="mt-2 font-serif text-2xl text-[var(--text-main)]">Windows voices are not ready</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-soft)]">
                {narratorStatus.message}
              </p>
            </div>
            <LinkButton href="/health" tone="secondary">Open health check</LinkButton>
          </div>
        </Panel>
      ) : null}
      <ProjectStudio project={project} voices={narratorStatus.voices} />
    </main>
  );
}

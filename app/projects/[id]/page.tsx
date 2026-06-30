import { notFound } from "next/navigation";

import { ProjectStudio } from "@/components/project-studio";
import { Badge, LinkButton } from "@/components/ui";
import { getProject, getVoices } from "@/lib/server/projects";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = await Promise.all([getProject(id), getVoices()]).catch(() => null);
  if (!data) {
    notFound();
  }

  const [project, voices] = data;

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
      <ProjectStudio project={project} voices={voices} />
    </main>
  );
}

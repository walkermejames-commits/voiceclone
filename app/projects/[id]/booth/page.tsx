import { notFound } from "next/navigation";

import { PerformanceBooth } from "@/components/performance-booth";
import { LinkButton } from "@/components/ui";
import { getProject } from "@/lib/server/projects";

export default async function ProjectBoothPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id).catch(() => null);

  if (!project) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-[1800px] px-6 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">ChipVoice Studio</p>
          <h1 className="mt-2 font-serif text-4xl">Narration booth</h1>
        </div>
        <LinkButton href={`/projects/${project.id}`} tone="ghost">
          Back to studio
        </LinkButton>
      </div>
      <PerformanceBooth project={project} />
    </main>
  );
}

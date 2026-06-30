import { mkdir } from "node:fs/promises";
import os from "node:os";

import packageJson from "@/package.json";
import { Badge, LinkButton, Panel } from "@/components/ui";
import { getNarratorStatus, listProjects } from "@/lib/server/projects";
import { PROJECTS_ROOT, pathExists } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

function statusBadge(ok: boolean) {
  return <Badge className={ok ? "text-green-200" : "text-yellow-200"}>{ok ? "OK" : "Check"}</Badge>;
}

export default async function HealthPage() {
  await mkdir(PROJECTS_ROOT, { recursive: true });
  const [narratorStatus, projects, dataRootExists] = await Promise.all([
    getNarratorStatus(),
    listProjects(),
    pathExists(PROJECTS_ROOT),
  ]);

  const checks = [
    ["App version", packageJson.version],
    ["Platform", `${process.platform} (${os.release()})`],
    ["Node", process.version],
    ["Data directory", dataRootExists ? PROJECTS_ROOT : "Missing"],
    ["Project count", String(projects.length)],
    ["Windows voices", String(narratorStatus.voiceCount)],
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">Health check</p>
          <h1 className="mt-2 font-serif text-5xl">ChipVoice Studio status</h1>
        </div>
        <LinkButton href="/" tone="secondary">Dashboard</LinkButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Panel className="p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl">Narrator backend</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">{narratorStatus.message}</p>
            </div>
            {statusBadge(narratorStatus.ok)}
          </div>
          {narratorStatus.voices.length > 0 ? (
            <div className="mt-6 grid gap-2">
              {narratorStatus.voices.map((voice) => (
                <div key={voice} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 text-sm">
                  {voice}
                </div>
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel className="p-8">
          <h2 className="font-serif text-3xl">Runtime checks</h2>
          <div className="mt-6 grid gap-3">
            {checks.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">{label}</div>
                <div className="mt-2 break-all text-sm text-[var(--text-main)]">{value}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  );
}

import { Button, Field, Input, LinkButton, Panel, Textarea } from "@/components/ui";

const FIRST_RUN_STEPS = [
  "Install Node.js 20 or newer.",
  "Run npm install.",
  "Run npm run dev.",
  "Open http://localhost:3000.",
  "Create a project.",
  "Paste the sample manuscript.",
  "Pick an installed Windows voice.",
  "Generate one sentence.",
  "Generate a chapter preview.",
  "Export a WAV or ZIP.",
];

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const error = (await searchParams)?.error;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">New project</p>
          <h1 className="mt-2 font-serif text-5xl">Start a clean audiobook workspace</h1>
        </div>
        <LinkButton href="/" tone="ghost">Back to dashboard</LinkButton>
      </div>

      {error ? (
        <Panel className="mb-6 border-yellow-500/40 bg-yellow-950/20">
          <p className="text-xs uppercase tracking-[0.24em] text-yellow-200">Setup issue</p>
          <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">{error}</p>
          <div className="mt-4">
            <LinkButton href="/health" tone="secondary">Open health check</LinkButton>
          </div>
        </Panel>
      ) : null}

      <Panel className="p-8">
        <form action="/api/projects/new" method="post" className="grid gap-5">
          <Field label="Project title">
            <Input name="title" placeholder="The Glass Harbour" required />
          </Field>
          <Field label="Author">
            <Input name="author" placeholder="Avery Morgan" required />
          </Field>
          <Field label="Description" hint="optional">
            <Textarea name="description" rows={5} placeholder="Short production note, target audience, or narrator intent." />
          </Field>
          <div className="flex justify-end gap-3">
            <LinkButton href="/" tone="secondary">Cancel</LinkButton>
            <Button type="submit">Create project</Button>
          </div>
        </form>
      </Panel>

      <Panel className="mt-6 p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">First run checklist</p>
        <ol className="mt-4 grid gap-3 text-sm leading-7 text-[var(--text-soft)]">
          {FIRST_RUN_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Panel>
    </main>
  );
}

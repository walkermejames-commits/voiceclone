import { Button, Field, Input, LinkButton, Panel, Textarea } from "@/components/ui";

export default function NewProjectPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">New project</p>
          <h1 className="mt-2 font-serif text-5xl">Start a clean audiobook workspace</h1>
        </div>
        <LinkButton href="/" tone="ghost">Back to dashboard</LinkButton>
      </div>

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
    </main>
  );
}

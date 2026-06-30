import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_ROOT = path.join(process.cwd(), "data");
export const PROJECTS_ROOT = path.join(DATA_ROOT, "projects");

export function projectDir(projectId: string) {
  return path.join(PROJECTS_ROOT, projectId);
}

export function projectFile(projectId: string) {
  return path.join(projectDir(projectId), "project.json");
}

export function annotatedScriptFile(projectId: string) {
  return path.join(projectDir(projectId), "annotated-script", "script.json");
}

export function recordingsFile(projectId: string) {
  return path.join(projectDir(projectId), "recordings", "takes.json");
}

export async function ensureProjectScaffold(projectId: string) {
  const root = projectDir(projectId);
  await mkdir(path.join(root, "audio", "sentences"), { recursive: true });
  await mkdir(path.join(root, "audio", "chapters"), { recursive: true });
  await mkdir(path.join(root, "annotated-script"), { recursive: true });
  await mkdir(path.join(root, "recordings"), { recursive: true });
  await mkdir(path.join(root, "exports"), { recursive: true });
  await mkdir(path.join(root, "assets"), { recursive: true });
  await mkdir(path.join(root, "assets", "reference-audio"), { recursive: true });
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeJsonFile(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function writeBufferFile(filePath: string, buffer: Buffer) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
}

export async function pathExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listProjectIds() {
  await mkdir(PROJECTS_ROOT, { recursive: true });
  const entries = await readdir(PROJECTS_ROOT, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

export function sanitizeFileSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "item";
}

export function safeProjectPath(projectId: string, relativePath: string) {
  const fullPath = path.normalize(path.join(projectDir(projectId), relativePath));
  const root = projectDir(projectId);
  if (!fullPath.startsWith(root)) {
    throw new Error("Invalid project path");
  }
  return fullPath;
}

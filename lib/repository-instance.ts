import { InMemoryStudioRepository } from "@/lib/repository";
import { SAMPLE_PROJECT } from "@/lib/sample-project";

declare global {
  // eslint-disable-next-line no-var
  var __scenovaRepository: InMemoryStudioRepository | undefined;
  // eslint-disable-next-line no-var
  var __scenovaSeeded: boolean | undefined;
}

export const studioRepository = globalThis.__scenovaRepository ?? new InMemoryStudioRepository();
if (process.env.NODE_ENV !== "production") globalThis.__scenovaRepository = studioRepository;

export async function ensureDevelopmentSeed(userId = "demo-user") {
  if (globalThis.__scenovaSeeded) return;
  await studioRepository.saveProject(userId, JSON.parse(JSON.stringify(SAMPLE_PROJECT)));
  globalThis.__scenovaSeeded = true;
}

import type { Character, Episode, Project } from "@/lib/domain";

export interface StudioRepository {
  listProjects(userId: string): Promise<Project[]>;
  getProject(userId: string, projectId: string): Promise<Project | null>;
  saveProject(userId: string, project: Project): Promise<Project>;
  deleteProject(userId: string, projectId: string): Promise<void>;
  saveCharacter(userId: string, projectId: string, character: Character): Promise<Character>;
  saveEpisode(userId: string, projectId: string, episode: Episode): Promise<Episode>;
}

/**
 * ใช้สำหรับพัฒนา UI/Core ก่อนต่อ PostgreSQL จริง
 * ห้ามใช้ใน production เพราะข้อมูลหายเมื่อ process restart
 */
export class InMemoryStudioRepository implements StudioRepository {
  private projects = new Map<string, Project>();

  private key(userId: string, projectId: string) {
    return `${userId}:${projectId}`;
  }

  async listProjects(userId: string) {
    return [...this.projects.entries()].filter(([key]) => key.startsWith(`${userId}:`)).map(([, project]) => project);
  }

  async getProject(userId: string, projectId: string) {
    return this.projects.get(this.key(userId, projectId)) ?? null;
  }

  async saveProject(userId: string, project: Project) {
    this.projects.set(this.key(userId, project.id), project);
    return project;
  }

  async deleteProject(userId: string, projectId: string) {
    this.projects.delete(this.key(userId, projectId));
  }

  async saveCharacter(userId: string, projectId: string, character: Character) {
    const project = await this.getProject(userId, projectId);
    if (!project) throw new Error("Project not found");
    const exists = project.characters.some((item) => item.id === character.id);
    project.characters = exists ? project.characters.map((item) => (item.id === character.id ? character : item)) : [...project.characters, character];
    await this.saveProject(userId, project);
    return character;
  }

  async saveEpisode(userId: string, projectId: string, episode: Episode) {
    const project = await this.getProject(userId, projectId);
    if (!project) throw new Error("Project not found");
    const exists = project.episodes.some((item) => item.id === episode.id);
    project.episodes = exists ? project.episodes.map((item) => (item.id === episode.id ? episode : item)) : [...project.episodes, episode];
    await this.saveProject(userId, project);
    return episode;
  }
}

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WORKSPACE_NAV, getWorkspaceContext, getWorkspaceRail } from "@/lib/workspace-navigation";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("workspace navigation audit", () => {
  it("keeps primary workspaces reachable and groups Storyboard under Series Studio", () => {
    const hrefs = WORKSPACE_NAV.map((item) => item.href);
    expect(hrefs).toContain("/portal");
    expect(hrefs).toContain("/studio");
    expect(hrefs).toContain("/agent");
    expect(hrefs).toContain("/series");
    expect(hrefs).not.toContain("/director");
    expect(WORKSPACE_NAV.find((item) => item.href === "/series")?.activePaths).toEqual(
      expect.arrayContaining(["/series", "/director", "/camera", "/dialogue", "/reference"]),
    );
    expect(hrefs).toContain("/libraries");
    expect(hrefs).toContain("/profile");
  });

  it("provides a known context and functional rail for every authenticated workspace family", () => {
    const paths = [
      "/portal",
      "/studio",
      "/agent",
      "/series",
      "/director",
      "/camera",
      "/dialogue",
      "/reference",
      "/libraries",
      "/models",
      "/render",
      "/wallet",
      "/guide",
      "/profile",
      "/profile/api",
      "/admin",
      "/admin/users",
      "/admin/security",
      "/admin/ai-costs",
    ];

    for (const pathname of paths) {
      expect(getWorkspaceContext(pathname), `${pathname} must have a workspace context`).not.toBe("SCENOVA Studio");
      expect(getWorkspaceRail(pathname).length, `${pathname} must resolve a functional rail`).toBeGreaterThan(0);
    }
  });
});

describe("workspace theme audit", () => {
  const layout = read("app/layout.tsx");
  const themeV5 = read("app/theme-audit-v5.css");
  const cinematic = read("app/theme-audit-cinematic-v1.css");
  const agentCss = read("components/agent-control-center.module.css");
  const settings = read("app/settings-system-v1.css");
  const series = read("app/series-theme-fix-v5.css");
  const studio = read("components/single-episode-studio.module.css");

  it("loads final theme audit layers after legacy workspace styles", () => {
    expect(layout).toContain('import "./theme-audit-v5.css";');
    expect(layout).toContain('import "./theme-audit-cinematic-v1.css";');
    expect(layout.indexOf('theme-audit-cinematic-v1.css')).toBeGreaterThan(layout.indexOf('theme-audit-v5.css'));
  });

  it("maps all shared legacy token names to canonical SCENOVA tokens", () => {
    for (const token of ["--sc-border", "--surface", "--surface2", "--surface3", "--input", "--border", "--accent", "--text", "--muted"]) {
      expect(themeV5, `${token} must be mapped`).toContain(token);
    }
  });

  it("covers workspaces that historically contained hard-coded dark UI", () => {
    for (const context of ["AI Agent", "Model Center", "คิวสร้างวิดีโอ", "เครดิตและค่าใช้จ่าย", "คลังทรัพยากร"]) {
      expect(themeV5, `${context} needs explicit audit coverage`).toContain(context);
    }
    expect(cinematic).toContain('data-workspace="Cinematic Direction"');
  });

  it("keeps dedicated Studio, Series and Settings light-theme support", () => {
    expect(studio).toContain('html[data-theme="light"]');
    expect(series).toContain('data-workspace="Series"');
    expect(series).toContain('html[data-theme="light"]');
    expect(settings).toContain('data-workspace="การตั้งค่า"');
    expect(settings).toContain('data-workspace="การตั้งค่า / API & Models"');
  });

  it("keeps the AI Agent surface token based and removes its duplicate AppShell top rail", () => {
    expect(agentCss).toContain("var(--agent-panel)");
    expect(agentCss).toContain("var(--sc-panel)");
    expect(agentCss).not.toContain("background:#0c0911");
    expect(agentCss).not.toContain("background:#0a0810");
    expect(themeV5).toContain('[data-workspace="AI Agent"]');
    expect(themeV5).toContain('> [data-sc-topbar]');
    expect(themeV5).toContain("display: none !important");
  });
});

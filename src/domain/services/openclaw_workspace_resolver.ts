import { readFileSync } from "node:fs";
import path from "node:path";

type OpenClawConfigShape = {
  agents?: {
    defaults?: {
      workspace?: unknown;
    };
  };
};

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveWorkspaceFolderName(env: NodeJS.ProcessEnv): string {
  const profile = env.OPENCLAW_PROFILE?.trim();
  if (profile && profile.toLowerCase() !== "default") {
    return `workspace-${profile}`;
  }
  return "workspace";
}

export function resolveOpenClawWorkspaceFromConfig(
  openClawHome: string,
  config: OpenClawConfigShape | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configuredWorkspace = normalizeString(config?.agents?.defaults?.workspace);
  if (configuredWorkspace) {
    return path.normalize(
      path.isAbsolute(configuredWorkspace)
        ? path.resolve(configuredWorkspace)
        : path.resolve(openClawHome, configuredWorkspace),
    );
  }

  return path.join(openClawHome, resolveWorkspaceFolderName(env));
}

export function resolveOpenClawHomeFromStateDir(stateDir: string): string {
  const normalized = path.resolve(stateDir);
  const marker = `${path.sep}extensions${path.sep}securityclaw`;
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) {
    return normalized;
  }

  const root = normalized.slice(0, markerIndex);
  return root || path.parse(normalized).root;
}

export function resolveConfiguredOpenClawWorkspace(
  stateDir: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const openClawHome = resolveOpenClawHomeFromStateDir(stateDir);
  const configPath = path.join(openClawHome, "openclaw.json");

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as OpenClawConfigShape;
    return resolveOpenClawWorkspaceFromConfig(openClawHome, parsed, env);
  } catch {
    // Fall back to the conventional workspace path when the config file is
    // missing, unreadable, or uses non-JSON features.
  }

  return resolveOpenClawWorkspaceFromConfig(openClawHome, undefined, env);
}

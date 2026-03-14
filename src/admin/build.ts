import { build } from "esbuild";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type AdminBuildLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
};

type AdminBuildPaths = {
  sourceDir: string;
  entryPoint: string;
  outfile: string;
};

type AdminBuildResult = {
  state: "built" | "skipped";
  paths: AdminBuildPaths;
};

type AdminBuildOptions = {
  force?: boolean;
  logger?: AdminBuildLogger;
  paths?: Partial<AdminBuildPaths>;
};

type GlobalWithSafeClawAdminBuild = typeof globalThis & {
  __safeclawAdminBuildPromise?: Promise<AdminBuildResult>;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function resolvePaths(overrides: Partial<AdminBuildPaths> = {}): AdminBuildPaths {
  return {
    sourceDir: overrides.sourceDir ?? path.resolve(ROOT, "admin/src"),
    entryPoint: overrides.entryPoint ?? path.resolve(ROOT, "admin/src/app.jsx"),
    outfile: overrides.outfile ?? path.resolve(ROOT, "admin/public/app.js")
  };
}

function newestMtimeMs(target: string): number {
  const stat = statSync(target);
  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }

  let newest = 0;
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const candidate = newestMtimeMs(path.join(target, entry.name));
    if (candidate > newest) {
      newest = candidate;
    }
  }
  return newest || stat.mtimeMs;
}

export function shouldBuildAdminAssets(options: Pick<AdminBuildOptions, "paths"> = {}): boolean {
  const paths = resolvePaths(options.paths);
  if (!existsSync(paths.outfile)) {
    return true;
  }
  return newestMtimeMs(paths.sourceDir) > statSync(paths.outfile).mtimeMs;
}

export async function ensureAdminAssetsBuilt(options: AdminBuildOptions = {}): Promise<AdminBuildResult> {
  const paths = resolvePaths(options.paths);
  if (!options.force && !shouldBuildAdminAssets({ paths })) {
    return { state: "skipped", paths };
  }

  const state = globalThis as GlobalWithSafeClawAdminBuild;
  if (state.__safeclawAdminBuildPromise) {
    return state.__safeclawAdminBuildPromise;
  }

  const logger = options.logger ?? {};
  mkdirSync(path.dirname(paths.outfile), { recursive: true });

  const promise = build({
    entryPoints: [paths.entryPoint],
    outfile: paths.outfile,
    bundle: true,
    format: "esm",
    target: ["es2022"],
    sourcemap: false,
    minify: true,
    define: {
      "process.env.NODE_ENV": "\"production\""
    }
  }).then(() => {
    logger.info?.(`SafeClaw admin bundle rebuilt: ${paths.outfile}`);
    return { state: "built" as const, paths };
  }).catch((error) => {
    logger.warn?.(`SafeClaw admin bundle build failed (${String(error)})`);
    throw error;
  }).finally(() => {
    delete state.__safeclawAdminBuildPromise;
  });

  state.__safeclawAdminBuildPromise = promise;
  return promise;
}

import type { Catalog, CatalogEntry, DelegatedCatalogEntry } from "./catalog.js";
import { findCatalogEntry } from "./catalog.js";
import {
  getPermissionReview,
  installMaintainedSkill,
  removeMaintainedSkill,
  updateMaintainedSkill,
  type MaintainedLifecycleOptions,
  type MaintainedLifecycleResult,
} from "./maintained.js";
import {
  formatArgv,
  formatRecipePermissionReview,
  runRecipeArgv,
  type RecipeRunResult,
} from "./recipe-runner.js";
import type { SupportedAgent, SupportedScope } from "./supported-options.js";

export { getPermissionReview };

export type LifecycleAction = "install" | "update" | "remove";

export interface LifecycleOptions {
  catalog: Catalog;
  name: string;
  action: LifecycleAction;
  projectDirectory: string;
  agent?: SupportedAgent;
  scope?: SupportedScope;
  dryRun?: boolean;
  acceptPermissions?: boolean;
  force?: boolean;
}

export interface LifecycleResult {
  entry: CatalogEntry;
  action: LifecycleAction;
  dryRun: boolean;
  message: string;
  permissionReview?: string;
  preview?: string;
  maintained?: MaintainedLifecycleResult;
  delegated?: RecipeRunResult;
}

export async function runLifecycle(
  options: LifecycleOptions,
): Promise<LifecycleResult> {
  const entry = findCatalogEntry(options.catalog, options.name);

  if (entry.kind === "link-only") {
    throw new Error(
      `Entry "${entry.name}" is link-only. Record a delegated recipe or maintained skill before install/update/remove.`,
    );
  }

  if (entry.kind === "maintained") {
    return runMaintainedLifecycle(options, entry);
  }

  return runDelegatedLifecycle(options, entry);
}

async function runMaintainedLifecycle(
  options: LifecycleOptions,
  entry: Extract<CatalogEntry, { kind: "maintained" }>,
): Promise<LifecycleResult> {
  if (options.agent === undefined) {
    throw new Error(
      `Maintained entry "${entry.name}" requires --agent <claude-code|codex>.`,
    );
  }

  const scope = options.scope ?? "project";
  const common: MaintainedLifecycleOptions = {
    source: entry.path,
    projectDirectory: options.projectDirectory,
    agent: options.agent,
    scope,
    ...(options.dryRun === undefined ? {} : { dryRun: options.dryRun }),
    ...(options.acceptPermissions === undefined
      ? {}
      : { acceptPermissions: options.acceptPermissions }),
    ...(options.force === undefined ? {} : { force: options.force }),
  };

  let maintained: MaintainedLifecycleResult;
  if (options.action === "install") {
    maintained = await installMaintainedSkill(common);
  } else if (options.action === "update") {
    maintained = await updateMaintainedSkill(common);
  } else {
    maintained = await removeMaintainedSkill(common);
  }

  const message =
    options.dryRun === true
      ? (maintained.preview ?? "").trimEnd()
      : `${pastTense(options.action)} ${maintained.skill.name}@${maintained.skill.version} for ${options.agent} (${scope})`;

  return {
    entry,
    action: options.action,
    dryRun: options.dryRun === true,
    message,
    ...(maintained.permissionReview === undefined
      ? {}
      : { permissionReview: maintained.permissionReview }),
    ...(maintained.preview === undefined ? {} : { preview: maintained.preview }),
    maintained,
  };
}

async function runDelegatedLifecycle(
  options: LifecycleOptions,
  entry: DelegatedCatalogEntry,
): Promise<LifecycleResult> {
  const argv = selectRecipeArgv(entry, options.action);
  const permissionReview = formatRecipePermissionReview({
    name: entry.name,
    action: options.action,
    upstream: entry.upstream,
    argv,
  });

  if (options.dryRun === true) {
    const preview = [
      `Dry run: delegated ${options.action} ${entry.name}`,
      `command: ${formatArgv(argv)}`,
      "",
    ].join("\n");
    return {
      entry,
      action: options.action,
      dryRun: true,
      message: preview.trimEnd(),
      permissionReview,
      preview,
    };
  }

  if (options.acceptPermissions !== true) {
    const error = new Error(
      "Delegated recipes require --accept-permissions.",
    );
    Object.assign(error, { permissionReview });
    throw error;
  }

  const delegated = await runRecipeArgv(argv, {
    cwd: options.projectDirectory,
  });

  return {
    entry,
    action: options.action,
    dryRun: false,
    message: `Delegated ${options.action} completed for ${entry.name}: ${formatArgv(argv)}`,
    permissionReview,
    delegated,
  };
}

function selectRecipeArgv(
  entry: DelegatedCatalogEntry,
  action: LifecycleAction,
): string[] {
  if (action === "install") {
    return entry.recipe.install;
  }
  if (action === "update") {
    if (entry.recipe.update === undefined) {
      throw new Error(
        `Delegated entry "${entry.name}" has no update recipe.`,
      );
    }
    return entry.recipe.update;
  }
  if (entry.recipe.remove === undefined) {
    throw new Error(
      `Delegated entry "${entry.name}" has no remove recipe. Remove it with the upstream tool manually.`,
    );
  }
  return entry.recipe.remove;
}

function pastTense(action: LifecycleAction): string {
  if (action === "install") {
    return "Installed";
  }
  if (action === "update") {
    return "Updated";
  }
  return "Removed";
}

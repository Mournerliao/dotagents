import { relative } from "node:path";

/** Convert an absolute skill path to a catalog-relative posix path. */
export function toCatalogRelativePath(
  catalogRootDirectory: string,
  absoluteSkillPath: string,
): string {
  const rel = relative(catalogRootDirectory, absoluteSkillPath);
  return rel.split("\\").join("/");
}

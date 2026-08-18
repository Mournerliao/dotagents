import {
  parseCatalogEntry,
  writeCatalog,
  type Catalog,
  type CatalogEntry,
} from "./catalog.js";

export async function recordCatalogEntry(
  catalog: Catalog,
  rawEntry: unknown,
): Promise<CatalogEntry> {
  const entry = await parseCatalogEntry(rawEntry, catalog.rootDirectory);
  const index = catalog.entries.findIndex((item) => item.name === entry.name);
  if (index === -1) {
    catalog.entries.push(entry);
  } else {
    catalog.entries[index] = entry;
  }
  await writeCatalog(catalog);
  return entry;
}

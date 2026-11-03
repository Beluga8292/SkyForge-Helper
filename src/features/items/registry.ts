import { useEffect, useSyncExternalStore } from "react";
import type { HypixelItem } from "@/types/hypixel";
import { useItemsResource } from "@/hooks/useBazaar";

export interface ItemRegistryEntry {
  id: string;
  name: string;
  material: string | null;
  category: string | null;
  tier: string | null;
}

const registry = new Map<string, ItemRegistryEntry>();
const byName = new Map<string, ItemRegistryEntry>();
const listeners = new Set<() => void>();
let version = 0;

function normalizeName(name: string): string {
  return name
    .replace(/§[0-9a-fk-or]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function emit(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): number {
  return version;
}

export function setItemRegistry(items: HypixelItem[]): void {
  registry.clear();
  byName.clear();
  for (const item of items) {
    if (!item.id) continue;
    const entry: ItemRegistryEntry = {
      id: item.id.toUpperCase(),
      name: item.name,
      material: item.material ?? null,
      category: item.category ?? null,
      tier: item.tier ?? null,
    };
    registry.set(entry.id, entry);
    if (item.name) {
      const key = normalizeName(item.name);
      if (key && !byName.has(key)) byName.set(key, entry);
    }
  }
  emit();
}

export function getItemRegistryEntry(itemId: string | null | undefined): ItemRegistryEntry | null {
  if (!itemId) return null;
  return registry.get(itemId.toUpperCase()) ?? null;
}

export function getItemRegistryEntryByName(
  name: string | null | undefined,
): ItemRegistryEntry | null {
  if (!name) return null;
  return byName.get(normalizeName(name)) ?? null;
}

/** Re-renders callers when the registry loads and resolves an item by display name. */
export function useItemRegistryByName(
  name: string | null | undefined,
): ItemRegistryEntry | null {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return getItemRegistryEntryByName(name);
}

export function listRegistryMaterials(): string[] {
  return [...new Set([...registry.values()].map((entry) => entry.material).filter((value): value is string => Boolean(value)))];
}

/** Re-renders callers when the shared item registry finishes loading. */
export function useItemRegistryEntry(itemId: string | null | undefined): ItemRegistryEntry | null {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return getItemRegistryEntry(itemId);
}

export function ItemRegistryLoader(): null {
  const query = useItemsResource();
  useEffect(() => {
    const items = query.data?.data.items;
    if (items?.length) setItemRegistry(items);
  }, [query.data]);
  return null;
}

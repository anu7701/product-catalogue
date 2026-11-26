import { createHash } from 'node:crypto';
import type { Category, CategoryId } from '@catalogue/shared';

/**
 * Fixed namespace for category IDs (T15). Never change it: every category ID,
 * and so every category link, is derived from it.
 */
export const CATEGORY_ID_NAMESPACE = 'd0fc132c-db46-4d4e-b0ac-e5bc15291d5f';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RFC 9562 UUID version 5 (SHA-1, name-based). */
export function uuidV5(name: string, namespace: string): string {
  if (!UUID_PATTERN.test(namespace)) {
    throw new Error(`Invalid namespace UUID: ${namespace}`);
  }
  const namespaceBytes = Buffer.from(namespace.replaceAll('-', ''), 'hex');
  const hash = createHash('sha1').update(namespaceBytes).update(Buffer.from(name, 'utf8')).digest();

  const bytes = hash.subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50; // version 5
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // RFC 9562 variant

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Category ID from the data source's category name (T15): deterministic, so
 * the same category keeps the same ID (and links) across restarts and servers.
 * The only place category IDs are derived (R-09).
 */
export function categoryId(sourceName: string): CategoryId {
  return uuidV5(sourceName, CATEGORY_ID_NAMESPACE);
}

/** Category IDs from URLs match case-insensitively, as UUIDs do (NEW-23). */
export function isSameCategoryId(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Display label: first letter capitalised, otherwise as provided (NEW-02). */
export function categoryLabel(sourceName: string): string {
  return sourceName.charAt(0).toUpperCase() + sourceName.slice(1);
}

export function toCategory(sourceName: string): Category {
  return { id: categoryId(sourceName), name: categoryLabel(sourceName) };
}

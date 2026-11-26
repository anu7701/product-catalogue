/**
 * Store name shown in the header and browser tab (CFG-04). Set at build time
 * with VITE_STORE_NAME; changing it needs a rebuild (ARCHITECTURE §2.4).
 */
export const STORE_NAME = import.meta.env.VITE_STORE_NAME?.trim() || 'Catalogue';

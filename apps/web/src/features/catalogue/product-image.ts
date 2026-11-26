import type { SyntheticEvent } from 'react';

/** Shown when a product image can't load (NEW-06). Served by the web app itself. */
export const PLACEHOLDER_IMAGE = '/product-placeholder.svg';

/** Swap a broken product image for the placeholder (once, so a broken placeholder can't loop). */
export function showPlaceholderOnError(event: SyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget;
  if (!image.src.endsWith(PLACEHOLDER_IMAGE)) {
    image.src = PLACEHOLDER_IMAGE;
  }
}

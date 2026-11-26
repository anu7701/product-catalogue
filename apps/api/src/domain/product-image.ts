/** Image bytes ready to send to the browser through our proxy (ARCHITECTURE §10.3). */
export interface ProductImage {
  /** Always an `image/*` media type. */
  contentType: string;
  body: Buffer;
}

/** Largest image the proxy will pass through (ARCHITECTURE §10.3, R-18). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

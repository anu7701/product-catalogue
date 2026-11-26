/**
 * Domain errors thrown by services and adapters (ARCHITECTURE §8.2).
 * The HTTP layer maps each to a status code and Problem Details response;
 * nothing else needs to know about HTTP.
 */
export abstract class DomainError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A product ID matches no product (PRD-02). */
export class ProductNotFoundError extends DomainError {
  readonly productId: string;

  constructor(productId: string) {
    super(`Product not found: ${productId}`);
    this.productId = productId;
  }
}

/** A category ID matches no category (CAT-02). */
export class CategoryNotFoundError extends DomainError {
  readonly categoryId: string;

  constructor(categoryId: string) {
    super(`Category not found: ${categoryId}`);
    this.categoryId = categoryId;
  }
}

/** An enquiry names a product that no longer exists (NEW-36). */
export class ProductUnavailableError extends DomainError {
  readonly productId: string;

  constructor(productId: string) {
    super(`Product unavailable for enquiry: ${productId}`);
    this.productId = productId;
  }
}

/** The product data source timed out, failed or returned unusable data (GLB-03). */
export class UpstreamUnavailableError extends DomainError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** The email provider did not accept the enquiry email (ENQ-05). */
export class EmailDeliveryFailedError extends DomainError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

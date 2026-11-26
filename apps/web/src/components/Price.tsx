const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Display price in USD with two decimals, e.g. $109.95; $0.00 is shown, not hidden (A22, NEW-08). */
export function formatPrice(price: number): string {
  return usd.format(price);
}

export function Price({ price, className }: { price: number; className?: string }) {
  return <span className={className}>{formatPrice(price)}</span>;
}

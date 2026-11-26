import type { Rating as RatingValue } from '@catalogue/shared';

/**
 * Average (one decimal) and number of ratings, e.g. "3.9 (120)" (NEW-04),
 * with a full sentence for screen readers. Nothing when unrated (NEW-07).
 */
export function Rating({ rating, className }: { rating: RatingValue | null; className?: string }) {
  if (!rating) return null;
  const average = rating.average.toFixed(1);
  const label = `Rated ${average} out of 5 from ${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'}`;
  return (
    <span className={className} aria-label={label} role="img">
      <span aria-hidden="true">
        ★ {average} ({rating.count})
      </span>
    </span>
  );
}

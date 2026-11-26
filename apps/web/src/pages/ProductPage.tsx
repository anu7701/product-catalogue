import { useParams } from 'react-router';
import { useDocumentTitle } from '../app/useDocumentTitle.ts';
import { NotFoundView } from '../components/NotFoundView.tsx';
import { QueryView } from '../components/PageState.tsx';
import { CategoryLinks } from '../features/catalogue/CategoryLinks.tsx';
import { ProductDetails } from '../features/catalogue/ProductDetails.tsx';
import { useProduct } from '../features/catalogue/queries.ts';
import { EnquiryPanel } from '../features/enquiry/EnquiryPanel.tsx';

/**
 * Product page (PRD-01). Unknown or stale ID → not-found with ways back into
 * the catalogue and no Enquire button (PRD-02); an unavailable source shows
 * the error state, never "not found".
 */
export function ProductPage() {
  const { productId = '' } = useParams();
  const query = useProduct(productId);
  useDocumentTitle(query.data?.title ?? (query.isError ? 'Product' : undefined));

  return (
    <QueryView
      query={query}
      notFound={
        <NotFoundView
          title="We couldn't find that product."
          message="It may no longer be available."
        >
          <CategoryLinks label="Browse a category" />
        </NotFoundView>
      }
    >
      {(product) => (
        <ProductDetails
          product={product}
          // A new product starts a fresh enquiry (ENQ-01 BR1, NEW-30).
          actions={<EnquiryPanel key={product.id} product={product} />}
        />
      )}
    </QueryView>
  );
}

import type { RouteObject } from 'react-router';
import { CategoryPage } from '../pages/CategoryPage.tsx';
import { HomePage } from '../pages/HomePage.tsx';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';
import { ProductPage } from '../pages/ProductPage.tsx';
import { SearchPage } from '../pages/SearchPage.tsx';
import { Layout } from './Layout.tsx';

/** Every page has its own address (GLB-04, ARCHITECTURE §2.3). */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'category/:categoryId', element: <CategoryPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'product/:productId', element: <ProductPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

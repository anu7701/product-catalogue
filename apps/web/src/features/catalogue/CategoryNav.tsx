import { NavLink } from 'react-router';
import { categoryPath } from './paths.ts';
import { useCategories } from './queries.ts';

/**
 * A link to every category (GLB-01, NEW-01). If categories can't be loaded,
 * the links are left out and the rest of the header still works (GLB-01 error).
 */
export function CategoryNav({ className }: { className?: string }) {
  const { data } = useCategories();
  if (!data || data.items.length === 0) return null;

  return (
    <nav aria-label="Categories" className={className}>
      <ul>
        {data.items.map((category) => (
          <li key={category.id}>
            <NavLink to={categoryPath(category.id)}>{category.name}</NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

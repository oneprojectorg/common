import { Input } from '@op/sense/Input';
import { toast } from '@op/sense/Toast';
import { LuSearch } from 'react-icons/lu';

/**
 * PROTOTYPE ONLY.
 *
 * The header's search box, as a shape only. The real one queries profiles and
 * decisions; here it exists because the header reads wrong without it, and says
 * so if you use it rather than pretending to work.
 */
export const SearchInput = () => (
  <div className="relative w-full">
    <LuSearch
      className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
    <Input
      type="search"
      aria-label="Search"
      placeholder="Search"
      className="ps-9"
      onFocus={() => toast.info('Prototype: search is out of scope')}
    />
  </div>
);

import { trpc } from '@op/api/client';
import { ListBox, ListBoxItem } from '@op/ui/ListBox';
import { Popover } from '@op/ui/Popover';
import { ComboBox } from '@op/ui/RAC';
import { SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { useEffect, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { useDebounce } from 'use-debounce';

import { Link } from '@/lib/i18n';

export const SearchInput = () => {
  const [query, setQuery] = useState<string>('');
  const [debouncedQuery] = useDebounce(query, 500);
  const { data: organizationResults } = trpc.organization.search.useQuery({
    q: debouncedQuery,
  });

  useEffect(() => {
    console.log('debouncedQuery:', debouncedQuery);
  }, [debouncedQuery]);

  return (
    <>
      <TextField
        inputProps={{
          placeholder: 'Search',
          color: 'muted',
          size: 'small',
          icon: <LuSearch className="size-4 text-neutral-gray4" />,
        }}
        onChange={(e) => setQuery(e)}
        value={query}
        className="w-96"
        aria-label="Search"
      />

      <Popover className="absolute z-10 !max-h-60 w-[--trigger-width] min-w-[--trigger-width] rounded border border-neutral-gray1 bg-white p-2 shadow">
        <ListBox items={organizationResults}>
          {(item) => (
            <SelectItem
              id={item.id}
              className="group flex cursor-pointer select-none items-center gap-2 rounded-sm py-2 pl-2 pr-4"
            >
              <Link href={`/org/${item.slug}`}>{item.name}</Link>
            </SelectItem>
          )}
        </ListBox>
      </Popover>
    </>
  );
};

import { LuSearch } from 'react-icons/lu';

import { TextField } from '@op/ui/TextField';

import { CommonLogo } from '../CommonLogo';
import { OPLogo } from '../OPLogo';

export const SiteHeader = () => {
  return (
    <header className="flex h-14 w-full items-center justify-between border-b px-4 py-7 md:px-28">
      <div className="flex gap-1">
        <OPLogo />
        <CommonLogo />
      </div>
      <TextField
        inputProps={{
          placeholder: 'Search',
          color: 'muted',
          size: 'small',
          icon: <LuSearch className="text-darkGray" />,
        }}
        className="w-96"
        aria-label="Search"
      />

      <div className="size-4 rounded-full bg-teal" />
    </header>
  );
};

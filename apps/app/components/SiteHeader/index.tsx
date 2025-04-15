import { TextField } from '@op/ui/TextField';

import { OPLogo } from '../OPLogo';

export const SiteHeader = () => {
  return (
    <header className="flex h-14 w-full items-center justify-between px-28 py-7">
      <OPLogo />
      <TextField placeholder="Search" aria-label="Search" />
      <div className="size-4 rounded-full bg-teal" />
    </header>
  );
};

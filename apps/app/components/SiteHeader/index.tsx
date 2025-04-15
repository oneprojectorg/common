import { TextField } from '@op/ui/TextField';

import { OPLogo } from '../OPLogo';
import { CommonLogo } from '../CommonLogo';

export const SiteHeader = () => {
  return (
    <header className="flex h-14 w-full items-center justify-between border-b px-4 py-7 md:px-28">
      <div className="flex gap-1">
        <OPLogo />
        <CommonLogo />
      </div>
      <TextField
        placeholder="Search"
        className="w-96"
        aria-label="Search"
        color="muted"
        size="small"
      />

      <div className="size-4 rounded-full bg-teal" />
    </header>
  );
};

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    // The semantic <main> is provided by the SidebarInset wrapper in the (main)
    // layout; this is the centered content column. A page opts out of the
    // width cap by rendering an element with `data-layout="full-bleed"`.
    <div className="flex grow justify-center">
      <div className="w-full max-w-[68rem] has-data-[layout=full-bleed]:max-w-none">
        {children}
      </div>
    </div>
  );
};

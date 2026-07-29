export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    // The semantic <main> is provided by the SidebarInset wrapper in the (main)
    // layout; this is just the centered content column.
    <div className="flex grow justify-center">
      <div className="w-full max-w-[68rem]">{children}</div>
    </div>
  );
};

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex grow justify-center">
      <main className="w-full max-w-[68rem]">{children}</main>
    </div>
  );
};

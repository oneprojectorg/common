export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex justify-center">
      <main className="w-full max-w-[49rem]">{children}</main>
    </div>
  );
};

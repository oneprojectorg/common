export const FormalSection = ({ children }: { children: React.ReactNode }) => {
  return (
    <section className="flex flex-col gap-6 text-foreground">
      {children}
    </section>
  );
};

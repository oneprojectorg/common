export const Header = ({ children }: { children: React.ReactNode }) => {
  return (
    <header className="text-center font-serif text-headerMobile sm:text-header">
      {children}
    </header>
  );
};

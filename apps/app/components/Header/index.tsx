export const Header = ({ children }: { children: React.ReactNode }) => {
  return (
    <header className="text-headerMobile sm:text-header text-center font-serif">
      {children}
    </header>
  );
};

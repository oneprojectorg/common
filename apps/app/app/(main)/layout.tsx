import '@op/ui/tailwind-styles';

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="size-full">
      <div className="flex size-full max-h-full flex-col overflow-hidden">
        <div className="relative flex min-h-0 grow flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MainLayout;

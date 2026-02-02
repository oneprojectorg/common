const LoginLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="flex size-full flex-col items-center overflow-y-auto p-4 md:justify-center md:p-8">
      <div className="py-7 sm:py-20">{children}</div>
    </main>
  );
};

export default LoginLayout;

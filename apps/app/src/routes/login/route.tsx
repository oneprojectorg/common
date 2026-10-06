import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/login')({
  component: LoginLayout,
});

function LoginLayout() {
  return (
    <main className="flex size-full flex-col items-center overflow-y-auto p-4 md:justify-center md:p-8">
      <div className="py-7 sm:py-20">
        <Outlet />
      </div>
    </main>
  );
}

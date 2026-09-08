import { Toaster } from '@op/sense/Toast';

import { PrototypeDecisionsList } from './components/prototype/PrototypeDecisionsList';
import { PrototypePhasePage } from './components/prototype/PrototypePhasePage';
import { PrototypeProcessPage } from './components/prototype/PrototypeProcessPage';
import { PrototypeShell } from './components/prototype/PrototypeShell';
import { PrototypeWizard } from './components/prototype/PrototypeWizard';
import { RouterProvider, usePathname } from './router';

/**
 * PROTOTYPE ONLY.
 *
 * The five screens, chosen by path. Each one is the same component the Next app
 * rendered — the routing is all that changed.
 */
function Screens() {
  const path = usePathname();
  const parts = path.split('/').filter(Boolean);

  // The wizard and the phase page are full-bleed; the rest sit in the app shell.
  if (parts[2] === 'new') {
    return <PrototypeWizard />;
  }

  if (parts[3] === 'phases') {
    return <PrototypePhasePage />;
  }

  if (parts[2]) {
    return <PrototypeProcessPage />;
  }

  return (
    <PrototypeShell>
      <PrototypeDecisionsList />
    </PrototypeShell>
  );
}

export function App() {
  return (
    /* Every `toast.*` in the prototype needs this provider above it — without
       one they resolve to nothing, which is worse than not calling them: half
       the stub actions here say what they did only through a toast. */
    <Toaster>
      <RouterProvider>
        <Screens />
      </RouterProvider>
    </Toaster>
  );
}

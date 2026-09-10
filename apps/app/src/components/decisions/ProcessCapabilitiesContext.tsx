'use client';

import {
  ALL_PROCESS_CAPABILITIES,
  type ProcessCapabilities,
} from '@op/common/client';
import { type ReactNode, createContext, useContext } from 'react';

/**
 * What the process the user is looking at offers — see `ProcessCapabilities`.
 *
 * Ambient rather than a prop because the controls a capability governs sit far
 * below the component that owns the instance: the comment button on a process
 * update is four components below the decision layout, and a proposal card's
 * comment count is three below the list. Threading a boolean through each of
 * them puts the capability in the signature of every component in between,
 * none of which use it, and leaves the ones nobody remembered to thread
 * silently showing a control the process has turned off.
 *
 * Mount the provider wherever a route resolves its instance. Anything rendered
 * outside one reads the "all on" default, which matches an unconfigured
 * process; the server re-derives every capability on write, so a missing
 * provider costs a control that fails on click, never an unguarded write.
 */
const ProcessCapabilitiesContext = createContext<ProcessCapabilities>(
  ALL_PROCESS_CAPABILITIES,
);

export function ProcessCapabilitiesProvider({
  capabilities,
  children,
}: {
  capabilities: ProcessCapabilities;
  children: ReactNode;
}) {
  return (
    <ProcessCapabilitiesContext.Provider value={capabilities}>
      {children}
    </ProcessCapabilitiesContext.Provider>
  );
}

/** The current process's capabilities; "all on" outside a provider. */
export function useProcessCapabilities(): ProcessCapabilities {
  return useContext(ProcessCapabilitiesContext);
}

'use client';

import { Button } from '@op/ui/Button';
import { trpc } from '@op/api/client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';

interface Phase {
  id: string;
  name: string;
  description?: string;
}

interface AdminTransitionControlsProps {
  instanceId: string;
  currentStateId: string;
  phases: Phase[];
}

export function AdminTransitionControls({
  instanceId,
  currentStateId,
  phases,
}: AdminTransitionControlsProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const router = useRouter();
  const executeTransitionMutation = useMutation({
    mutationFn: (input: { instanceId: string; toStateId: string }) =>
      trpc.decision.executeTransition.mutate(input),
  });

  const { data: transitionCheck, isLoading: isCheckingTransitions } = useQuery({
    queryKey: [['decision', 'checkTransitions'], { instanceId }],
    queryFn: () => trpc.decision.checkTransitions.query({ instanceId }),
  });

  const currentPhase = phases.find((phase) => phase.id === currentStateId);

  const handleTransition = async (toStateId: string, transitionName: string) => {
    if (isTransitioning) return;

    const confirmTransition = window.confirm(
      `Are you sure you want to execute the transition "${transitionName}"?`
    );
    
    if (!confirmTransition) return;

    setIsTransitioning(true);
    
    try {
      await executeTransitionMutation.mutateAsync({
        instanceId,
        toStateId,
      });
      
      alert(`Transition "${transitionName}" executed successfully!`);
      router.refresh(); // Refresh the page to show updated state
      
    } catch (error) {
      console.error('Failed to execute transition:', error);
      alert('Failed to execute transition. Please try again.');
    } finally {
      setIsTransitioning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Current State</h3>
        <div className="mt-2 rounded-md bg-blue-50 p-4">
          <p className="font-medium text-blue-900">
            {currentPhase?.name || currentStateId}
          </p>
          {currentPhase?.description && (
            <p className="mt-1 text-blue-700">{currentPhase.description}</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          Available Transitions
        </h3>
        {isCheckingTransitions ? (
          <p className="mt-2 text-gray-500">Checking transitions...</p>
        ) : !transitionCheck?.canTransition || transitionCheck.availableTransitions.length === 0 ? (
          <p className="mt-2 text-gray-500">
            No transitions available from the current state.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {transitionCheck.availableTransitions
              .filter(transition => transition.canExecute)
              .map((transition) => {
                const targetPhase = phases.find(
                  (phase) => phase.id === transition.toStateId,
                );

                return (
                  <div
                    key={transition.toStateId}
                    className="flex items-center justify-between rounded-md border border-gray-200 p-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {transition.transitionName}
                      </p>
                      <p className="text-sm text-gray-600">
                        Transition to: {targetPhase?.name || transition.toStateId}
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="small"
                      onPress={() => handleTransition(transition.toStateId, transition.transitionName)}
                      isDisabled={isTransitioning}
                    >
                      {isTransitioning ? 'Executing...' : 'Execute'}
                    </Button>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
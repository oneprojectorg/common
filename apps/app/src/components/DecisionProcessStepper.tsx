'use client';

interface ProcessPhase {
  id: string;
  name: string;
  description?: string;
  phase?: {
    startDate?: string;
    endDate?: string;
    sortOrder?: number;
  };
  type?: 'initial' | 'intermediate' | 'final';
}

interface DecisionProcessStepperProps {
  phases: ProcessPhase[];
  currentStateId: string;
  className?: string;
}

export function DecisionProcessStepper({
  phases,
  currentStateId,
  className = '',
}: DecisionProcessStepperProps) {
  const sortedPhases = phases
    .slice()
    .sort((a, b) => (a.phase?.sortOrder || 0) - (b.phase?.sortOrder || 0));

  const currentPhaseIndex = sortedPhases.findIndex(
    (phase) => phase.id === currentStateId
  );

  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return '';
    
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    };

    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    if (startDate) {
      return `From ${formatDate(startDate)}`;
    }
    if (endDate) {
      return `Until ${formatDate(endDate)}`;
    }
    return '';
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-center">
        {sortedPhases.map((phase, index) => (
          <div key={phase.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                  index <= currentPhaseIndex
                    ? 'bg-gray-900 text-white'
                    : 'border-2 border-gray-300 bg-white text-gray-400'
                }`}
              >
                {index + 1}
              </div>
              <div className="mt-3 text-center max-w-24">
                <div className="text-xs font-medium text-gray-900">
                  {phase.name}
                </div>
                {phase.phase && (
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDateRange(phase.phase.startDate, phase.phase.endDate)}
                  </div>
                )}
              </div>
            </div>
            {index < sortedPhases.length - 1 && (
              <div
                className={`mx-8 h-0.5 w-20 ${
                  index < currentPhaseIndex
                    ? 'bg-gray-900'
                    : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
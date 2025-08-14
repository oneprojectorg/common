'use client';

import { Button } from '@op/ui/Button';

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

interface DecisionInstanceContentProps {
  name: string;
  description?: string;
  budget?: number;
  currentPhase?: ProcessPhase;
  proposalCount: number;
  daysRemaining?: number;
  onSubmitProposal?: () => void;
}

export function DecisionInstanceContent({
  name,
  description,
  budget,
  currentPhase,
  proposalCount,
  daysRemaining,
  onSubmitProposal = () => {},
}: DecisionInstanceContentProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateDaysRemaining = () => {
    if (daysRemaining !== undefined) return daysRemaining;

    if (currentPhase?.phase?.endDate) {
      const endDate = new Date(currentPhase.phase.endDate);
      const today = new Date();
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }

    return null;
  };

  const remainingDays = calculateDaysRemaining();

  return (
    <div className="min-h-full bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Large centered heading */}
        <div className="mb-12 text-center">
          <h1 className="bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-5xl font-bold text-transparent">
            SHARE YOUR IDEAS.
          </h1>
          <p className="mt-4 text-base text-gray-700">
            Help determine how we invest our {budget ? formatCurrency(budget) : '$25,000'} community budget.
          </p>
        </div>

        {/* Main content card */}
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Left column */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {name}
              </h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                {description || 'Help decide how we allocate our $25,000 community budget. Submit proposals for initiatives that advance our mission of food justice through labor organizing.'}
              </p>
              
              <div className="mt-8">
                <Button
                  color="primary"
                  className="px-8 py-3 text-base"
                  onPress={onSubmitProposal}
                >
                  Submit a proposal
                </Button>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Current Phase */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  CURRENT PHASE
                </h3>
                <p className="mt-1 text-lg font-medium text-gray-900">
                  {currentPhase?.name || 'Proposal Submissions'}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {currentPhase?.phase?.startDate && currentPhase?.phase?.endDate
                    ? `${new Date(currentPhase.phase.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(currentPhase.phase.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'Sep 1 - 15, 2025'}
                </p>
              </div>

              {/* Stats */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Budget</span>
                  <span className="text-sm font-medium text-gray-900">
                    {budget ? formatCurrency(budget) : '$25,000'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Proposals Submitted</span>
                  <span className="text-sm font-medium text-gray-900">
                    {proposalCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Days Remaining</span>
                  <span className="text-sm font-medium text-gray-900">
                    {remainingDays !== null ? remainingDays : '14'}
                  </span>
                </div>
              </div>

              {/* No proposals section */}
              <div className="rounded-lg bg-gray-50 p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <h3 className="text-base font-medium text-gray-900">
                  No proposals yet.
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  You could be the first one to submit a proposal! 💡
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

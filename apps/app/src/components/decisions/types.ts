export interface ProcessPhase {
  id: string;
  name: string;
  description?: string;
  phase?: {
    startDate?: string;
    endDate?: string;
    sortOrder?: number;
  };
  type?: 'initial' | 'intermediate' | 'final';
  config?: {
    allowProposals?: boolean;
  };
}

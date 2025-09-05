/**
 * Configuration-driven transformation system for decision process data
 * This file defines mappings between schema, form fields, and database fields
 */

export interface PhaseMapping {
  formFieldName: string;       // e.g., 'ideaCollectionPhase'
  stateId: string;             // e.g., 'ideaCollection'
  displayName: string;         // e.g., 'Idea Collection'
  dateFields: {
    start: string;             // e.g., 'ideaCollectionOpen'
    end?: string;              // e.g., 'ideaCollectionClose'
  };
  dbFields: {
    start: 'plannedStartDate' | 'actualStartDate';
    end?: 'plannedEndDate' | 'actualEndDate';
  };
  sortOrder: number;
}

export interface FieldMapping {
  formField: string;
  dbPath: string[];           // Path to the field in database object
  transformer?: (value: any) => any;
  reverseTransformer?: (value: any) => any;
  defaultValue?: any;
}

export interface TransformationConfig {
  phases: PhaseMapping[];
  fields: FieldMapping[];
}

// Extract current hardcoded phase mappings
export const DEFAULT_PHASE_MAPPINGS: PhaseMapping[] = [
  {
    formFieldName: 'ideaCollectionPhase',
    stateId: 'ideaCollection',
    displayName: 'Idea Collection',
    dateFields: {
      start: 'ideaCollectionOpen',
      end: 'ideaCollectionClose'
    },
    dbFields: {
      start: 'plannedStartDate',
      end: 'plannedEndDate'
    },
    sortOrder: 1
  },
  {
    formFieldName: 'proposalSubmissionPhase',
    stateId: 'submission',
    displayName: 'Submissions',
    dateFields: {
      start: 'submissionsOpen',
      end: 'submissionsClose'
    },
    dbFields: {
      start: 'plannedStartDate',
      end: 'plannedEndDate'
    },
    sortOrder: 2
  },
  {
    formFieldName: 'reviewShortlistingPhase',
    stateId: 'review',
    displayName: 'Review',
    dateFields: {
      start: 'reviewOpen',
      end: 'reviewClose'
    },
    dbFields: {
      start: 'plannedStartDate',
      end: 'plannedEndDate'
    },
    sortOrder: 3
  },
  {
    formFieldName: 'votingPhase',
    stateId: 'voting',
    displayName: 'Voting',
    dateFields: {
      start: 'votingOpen',
      end: 'votingClose'
    },
    dbFields: {
      start: 'plannedStartDate',
      end: 'plannedEndDate'
    },
    sortOrder: 4
  },
  {
    formFieldName: 'resultsAnnouncement',
    stateId: 'results',
    displayName: 'Results',
    dateFields: {
      start: 'resultsDate'
    },
    dbFields: {
      start: 'plannedStartDate'
    },
    sortOrder: 5
  }
];

// Extract current hardcoded field mappings
export const DEFAULT_FIELD_MAPPINGS: FieldMapping[] = [
  {
    formField: 'processName',
    dbPath: ['name'],
    defaultValue: ''
  },
  {
    formField: 'description',
    dbPath: ['description'],
    defaultValue: ''
  },
  {
    formField: 'totalBudget',
    dbPath: ['instanceData', 'budget'],
    defaultValue: 0
  },
  {
    formField: 'hideBudget',
    dbPath: ['instanceData', 'hideBudget'],
    defaultValue: false
  },
  {
    formField: 'categories',
    dbPath: ['instanceData', 'fieldValues', 'categories'],
    defaultValue: []
  },
  {
    formField: 'budgetCapAmount',
    dbPath: ['instanceData', 'fieldValues', 'budgetCapAmount'],
    defaultValue: 0
  },
  {
    formField: 'descriptionGuidance',
    dbPath: ['instanceData', 'fieldValues', 'descriptionGuidance'],
    defaultValue: ''
  },
  {
    formField: 'maxVotesPerMember',
    dbPath: ['instanceData', 'fieldValues', 'maxVotesPerMember'],
    defaultValue: 3
  }
];

// Default configuration combining both mappings
export const DEFAULT_TRANSFORMATION_CONFIG: TransformationConfig = {
  phases: DEFAULT_PHASE_MAPPINGS,
  fields: DEFAULT_FIELD_MAPPINGS
};

// Helper functions for working with configurations
export const getPhaseByStateId = (stateId: string, config = DEFAULT_TRANSFORMATION_CONFIG): PhaseMapping | undefined => {
  return config.phases.find(phase => phase.stateId === stateId);
};

export const getPhaseByFormField = (formFieldName: string, config = DEFAULT_TRANSFORMATION_CONFIG): PhaseMapping | undefined => {
  return config.phases.find(phase => phase.formFieldName === formFieldName);
};

export const getFieldByFormName = (formField: string, config = DEFAULT_TRANSFORMATION_CONFIG): FieldMapping | undefined => {
  return config.fields.find(field => field.formField === formField);
};

// Generate validation sequence from phase mappings
export const getValidationSequence = (config = DEFAULT_TRANSFORMATION_CONFIG) => {
  return config.phases
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap(phase => {
      const sequence = [{
        name: `${phase.displayName} Open`,
        key: phase.dateFields.start,
        phase: phase.formFieldName
      }];
      
      if (phase.dateFields.end) {
        sequence.push({
          name: `${phase.displayName} Close`,
          key: phase.dateFields.end,
          phase: phase.formFieldName
        });
      }
      
      return sequence;
    });
};
import { describe, expect, it } from 'vitest';
import type { ProcessSchema } from '../types';

describe('Decision Services Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should import types without errors', () => {
    // TypeScript interfaces don't exist at runtime, but importing shouldn't fail
    const mockSchema: ProcessSchema = {
      name: 'Test',
      states: [],
      transitions: [],
      initialState: 'start',
      decisionDefinition: { type: 'object' },
      proposalTemplate: { type: 'object' },
    };
    expect(mockSchema.name).toBe('Test');
  });

  it('should import services without errors', async () => {
    // Test that our services can be imported
    const { createProcess } = await import('../createProcess');
    const { TransitionEngine } = await import('../transitionEngine');
    
    expect(typeof createProcess).toBe('function');
    expect(typeof TransitionEngine.checkAvailableTransitions).toBe('function');
  });
});
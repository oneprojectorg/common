/**
 * Voting schema registry.
 * Manages schema definitions and provides lookup/processing functionality.
 */

import type { VotingSchemaDefinition, SchemaProcessResult } from './types';
import { processWithSchema, matchesSchemaType } from './processor';
import {
  votingSchemaDefinitions,
  defaultSchema,
  simpleSchema,
  advancedSchema,
} from './definitions';

export class VotingSchemaRegistry {
  private schemas = new Map<string, VotingSchemaDefinition>();
  private defaultSchema: VotingSchemaDefinition;

  constructor() {
    this.defaultSchema = defaultSchema;

    // Register all built-in schemas
    for (const schema of votingSchemaDefinitions) {
      this.registerSchema(schema);
    }
  }

  /**
   * Register a new schema definition
   */
  registerSchema(schema: VotingSchemaDefinition): void {
    this.schemas.set(schema.schemaType, schema);
  }

  /**
   * Get a schema by type
   */
  getSchema(schemaType: string): VotingSchemaDefinition | null {
    return this.schemas.get(schemaType) || null;
  }

  /**
   * Get a schema by type, falling back to default
   */
  getSchemaOrDefault(schemaType: string): VotingSchemaDefinition {
    return this.schemas.get(schemaType) || this.defaultSchema;
  }

  /**
   * Get all registered schema types
   */
  getAllSchemaTypes(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Get all registered schemas
   */
  getAllSchemas(): VotingSchemaDefinition[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Detect which schema type matches the input data
   */
  detectSchemaType(data: unknown): string {
    // First check explicit schemaType field
    if (typeof data === 'object' && data !== null && 'schemaType' in data) {
      const explicitType = String((data as Record<string, unknown>).schemaType);
      if (this.schemas.has(explicitType)) {
        return explicitType;
      }
    }

    // Try to match against registered schemas
    for (const schema of this.schemas.values()) {
      if (matchesSchemaType(data, schema)) {
        return schema.schemaType;
      }
    }

    return 'default';
  }

  /**
   * Process form data and extract voting/proposal config.
   * Note: Validation should be handled by RJSF in the app layer.
   */
  processSchema(formData: Record<string, unknown>): SchemaProcessResult {
    const schemaType = this.detectSchemaType(formData);
    const schema = this.getSchemaOrDefault(schemaType);
    return processWithSchema(formData, schema);
  }
}

// Global registry instance
export const votingSchemaRegistry = new VotingSchemaRegistry();

/**
 * Process input data using the global registry
 */
export function processVotingSchema(data: unknown): SchemaProcessResult {
  return votingSchemaRegistry.processSchema(data);
}

/**
 * Register a custom schema definition
 */
export function registerVotingSchema(schema: VotingSchemaDefinition): void {
  votingSchemaRegistry.registerSchema(schema);
}

// Re-export types and schemas for convenience
export type { VotingSchemaDefinition };
export { simpleSchema, advancedSchema, defaultSchema };

/**
 * Template-authoring guards: the semantic checks AJV cannot express, run at
 * the persistence boundary next to `validateJsonSchema`.
 */
import { assertMoneyFieldSchemas } from './templateMoney';
import type { XFormatPropertySchema } from './types';

type AuthorableTemplate = {
  [key: string]: unknown;
  properties?: Record<string, XFormatPropertySchema | boolean>;
};

/** @throws ValidationError describing the first problem found. */
export function assertRubricTemplateAuthoring(
  template: AuthorableTemplate,
): void {
  assertMoneyFieldSchemas(template);
}

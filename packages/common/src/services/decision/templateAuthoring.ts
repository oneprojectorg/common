/**
 * Template-authoring guards — the semantic checks AJV cannot express.
 *
 * AJV answers "is this a compilable JSON Schema, and does this data satisfy
 * it". It cannot answer "will the form this schema describes actually work".
 * Vendor keys carry no shape schema of their own, so anything a client sends
 * under `x-sections` / `x-section` would otherwise persist unchecked and
 * surface as a broken form.
 *
 * These run at the persistence boundary, next to `validateJsonSchema`.
 */
import type { SectionableTemplate } from './templateSections';
import { assertContiguousTemplateSections } from './templateSections';
import type { XFormatPropertySchema } from './types';

/** A template shape these guards can read. */
type AuthorableTemplate = SectionableTemplate & {
  properties?: Record<string, XFormatPropertySchema | boolean>;
  'x-field-order'?: string[];
};

/**
 * Assert a rubric template is safely authored.
 *
 * @throws ValidationError describing the first problem found.
 */
export function assertRubricTemplateAuthoring(
  template: AuthorableTemplate,
): void {
  assertContiguousTemplateSections(template);
}

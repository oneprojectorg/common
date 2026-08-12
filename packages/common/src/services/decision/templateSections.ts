/**
 * Template sections — pure presentational grouping for JSON Schema templates.
 *
 * Both proposal templates and rubric templates are flat JSON Schema objects
 * with one property per field, ordered by `x-field-order`. Sections add
 * *layout only* on top of that, via two vendor keys:
 *
 * - top-level `x-sections: [{ id, title, description?, showTotal? }]`
 * - per-property `x-section: <sectionId>`
 *
 * Nothing else changes: answers stay keyed by the property id, `required`
 * stays top-level, validation and scoring keep iterating the flat property
 * map. Moving a field between sections therefore never moves its answer.
 *
 * These helpers are deliberately template-agnostic (no "rubric" in any name)
 * so proposal templates can adopt the same keys later. Only rubric rendering
 * consumes them today.
 */
import { ValidationError } from '../../utils';
import type { XFormatPropertySchema } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Top-level vendor key holding the section list. */
export const TEMPLATE_SECTIONS_KEY = 'x-sections';

/** Per-property vendor key naming the section a field belongs to. */
export const TEMPLATE_SECTION_KEY = 'x-section';

/** One declared section. `id` is opaque — never derived from the title. */
export interface TemplateSection {
  id: string;
  title: string;
  description?: string;
  /**
   * Render a derived total row after the section's members. The total is
   * computed at render time from the members' money answers and is never
   * stored (see `templateMoney.ts`).
   */
  showTotal?: boolean;
}

/**
 * A render block: either a standalone field or a section with its members.
 * Produced by {@link groupFieldsBySection}; the only thing sections do.
 */
export type TemplateSectionBlock<TField> =
  | { kind: 'field'; field: TField }
  | { kind: 'section'; section: TemplateSection; fields: TField[] };

/** Minimal shape {@link groupFieldsBySection} needs from a compiled field. */
export interface SectionableField {
  key: string;
  schema: XFormatPropertySchema;
}

/** Minimal shape the section readers need from a template. */
export interface SectionableTemplate {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/** Narrows unknown stored JSON to a plain (non-array) object. */
function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A non-blank string, the requirement for both section ids and titles. */
function readNonBlankString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * Declared sections of a template, in declaration order.
 *
 * Malformed entries — not an object, blank/missing/non-string id **or title**,
 * or a duplicate id — are dropped rather than thrown on. Templates are stored
 * JSON that no schema constrains (custom AJV keywords carry no shape), so a bad
 * section must degrade to "no section": its members then render ungrouped,
 * which is strictly better than wrapping them in a blank heading.
 */
export function getTemplateSections(
  template: SectionableTemplate,
): TemplateSection[] {
  const raw = template[TEMPLATE_SECTIONS_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }

  const sections: TemplateSection[] = [];
  const seenIds = new Set<string>();

  for (const entry of raw) {
    if (!isPlainObject(entry)) {
      continue;
    }
    const id = readNonBlankString(entry.id);
    const title = readNonBlankString(entry.title);
    if (id === undefined || title === undefined || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    sections.push({
      id,
      title,
      ...(typeof entry.description === 'string'
        ? { description: entry.description }
        : {}),
      ...(entry.showTotal === true ? { showTotal: true } : {}),
    });
  }

  return sections;
}

/** The section id declared on a property, if any. */
export function getFieldSectionId(
  schema: XFormatPropertySchema,
): string | undefined {
  const value = schema[TEMPLATE_SECTION_KEY];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Group compiled fields into render blocks.
 *
 * - `x-field-order` (already applied to `fields` by the caller's compiler)
 *   remains the single source of field order, inside and outside sections.
 *   Grouping never moves a field past another field: a section's members are
 *   required to be one contiguous run, enforced at the persistence boundary by
 *   {@link assertContiguousTemplateSections}.
 * - A field whose `x-section` names an unknown section renders ungrouped, as
 *   if the key were absent. Nothing is hidden and nothing throws.
 * - Sections with no members produce no block.
 * - A non-contiguous section can still reach this renderer from a template
 *   persisted before the guard existed. Rather than reorder, each run becomes
 *   its own block, so field order survives and the heading simply repeats.
 */
export function groupFieldsBySection<TField extends SectionableField>(
  template: SectionableTemplate,
  fields: TField[],
): TemplateSectionBlock<TField>[] {
  const sectionsById = new Map(
    getTemplateSections(template).map((section) => [section.id, section]),
  );

  if (sectionsById.size === 0) {
    return fields.map(
      (field): TemplateSectionBlock<TField> => ({ kind: 'field', field }),
    );
  }

  const blocks: TemplateSectionBlock<TField>[] = [];
  let openBlock:
    | { kind: 'section'; section: TemplateSection; fields: TField[] }
    | undefined;

  for (const field of fields) {
    const sectionId = getFieldSectionId(field.schema);
    const section = sectionId ? sectionsById.get(sectionId) : undefined;

    if (!section) {
      openBlock = undefined;
      blocks.push({ kind: 'field', field });
      continue;
    }

    if (openBlock?.section.id === section.id) {
      openBlock.fields.push(field);
      continue;
    }

    const block: {
      kind: 'section';
      section: TemplateSection;
      fields: TField[];
    } = {
      kind: 'section',
      section,
      fields: [field],
    };
    openBlock = block;
    blocks.push(block);
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Ordering + authoring guard
// ---------------------------------------------------------------------------

/**
 * The order fields are rendered in: `x-field-order` first, then any property
 * the order array forgot, appended. Mirrors what the app's schema compilers do,
 * so the authoring guard below reasons about the order users actually see.
 */
export function getOrderedFieldKeys(
  template: SectionableTemplate & {
    properties?: Record<string, XFormatPropertySchema | boolean>;
    'x-field-order'?: string[];
  },
): string[] {
  const properties = template.properties ?? {};
  const declaredOrder = Array.isArray(template['x-field-order'])
    ? template['x-field-order']
    : [];

  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const key of [...declaredOrder, ...Object.keys(properties)]) {
    if (!seen.has(key) && key in properties) {
      seen.add(key);
      ordered.push(key);
    }
  }

  return ordered;
}

/**
 * A section's members must form one contiguous run in the field order.
 *
 * Sections are pure layout, so grouping must never change which field comes
 * before which. If members were allowed to interleave with non-members, the
 * renderer would have to choose between reordering fields (breaking
 * `x-field-order` as the ordering authority) and repeating the section heading.
 * Neither is a state worth persisting, so it is rejected at the boundary and
 * the renderer stays simple.
 *
 * @throws ValidationError naming the section that is split.
 */
export function assertContiguousTemplateSections(
  template: SectionableTemplate & {
    properties?: Record<string, XFormatPropertySchema | boolean>;
    'x-field-order'?: string[];
  },
): void {
  const sectionIds = new Set(
    getTemplateSections(template).map((section) => section.id),
  );
  if (sectionIds.size === 0) {
    return;
  }

  const properties = template.properties ?? {};
  const closedSectionIds = new Set<string>();
  let openSectionId: string | undefined;

  for (const key of getOrderedFieldKeys(template)) {
    const definition = properties[key];
    const declared =
      typeof definition === 'object' && definition !== null
        ? getFieldSectionId(definition)
        : undefined;
    // An unknown section id degrades to ungrouped, so it also closes a run.
    const sectionId =
      declared !== undefined && sectionIds.has(declared) ? declared : undefined;

    if (sectionId === openSectionId) {
      continue;
    }

    if (sectionId !== undefined && closedSectionIds.has(sectionId)) {
      throw new ValidationError(
        `Section "${sectionId}" is split by other criteria; a section's members must be consecutive in x-field-order`,
        { [`x-sections.${sectionId}`]: 'Section members must be consecutive' },
      );
    }

    if (openSectionId !== undefined) {
      closedSectionIds.add(openSectionId);
    }
    openSectionId = sectionId;
  }
}

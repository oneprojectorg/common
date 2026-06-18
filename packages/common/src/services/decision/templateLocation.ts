import type { MapDefaultView, ProposalTemplateSchema } from './types';

/**
 * Whether a proposal template collects a location — i.e. has a field with the
 * `location` x-format. When true, a proposal's location is mandatory and must
 * fall inside a boundary to be submitted (see `submitProposal`).
 */
export function templateCollectsLocation(
  template: ProposalTemplateSchema | null | undefined,
): boolean {
  if (!template?.properties) {
    return false;
  }

  return Object.values(template.properties).some(
    (schema) => schema['x-format'] === 'location',
  );
}

/**
 * The default map camera (`x-map-default`) configured on a template's location
 * field, or `undefined` when the template collects no location / has no default
 * positioned. Shared by the proposal form and the proposals map browse view so
 * both open at the same place; callers fall back to
 * `DEFAULT_LOCATION_FIELD_MAP_VIEW`.
 */
export function getLocationFieldMapView(
  template: ProposalTemplateSchema | null | undefined,
): MapDefaultView | undefined {
  if (!template?.properties) {
    return undefined;
  }

  const locationField = Object.values(template.properties).find(
    (schema) => schema['x-format'] === 'location',
  );

  return locationField?.['x-map-default'];
}

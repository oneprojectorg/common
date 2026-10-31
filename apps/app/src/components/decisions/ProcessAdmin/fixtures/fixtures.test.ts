import { describe, expect, it } from 'vitest';

import { PROCESS_ADMIN_FIXTURE_NAMES, getProcessAdminFixture } from '.';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe.each(PROCESS_ADMIN_FIXTURE_NAMES)('fixture %s', (name) => {
  const fixture = getProcessAdminFixture(name);

  it('is named for its key', () => {
    expect(fixture.name).toBe(name);
  });

  it('keys every phase by a unique uuid', () => {
    const ids = fixture.phases.map((phase) => phase.id);
    expect(ids.every((id) => UUID.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders phases contiguously from zero', () => {
    expect(fixture.phases.map((phase) => phase.sortOrder)).toEqual(
      fixture.phases.map((_, index) => index),
    );
  });

  it('names every phase', () => {
    expect(fixture.phases.every((phase) => phase.name.length > 0)).toBe(true);
  });
});

describe('current phase', () => {
  it('is absent on the draft', () => {
    expect(
      getProcessAdminFixture('draft').phases.some((phase) => phase.isCurrent),
    ).toBe(false);
  });

  it('is exactly one phase on the live process', () => {
    expect(
      getProcessAdminFixture('live').phases.filter((phase) => phase.isCurrent),
    ).toHaveLength(1);
  });
});

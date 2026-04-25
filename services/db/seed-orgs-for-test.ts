// Minimal seeder for the docker dev stack: creates One Project (with
// domain=oneproject.org so onboarding domain-match pre-selects it) and
// Common (no domain match) so the join-already-joined regression can be
// reproduced end-to-end. Idempotent.
import { eq } from 'drizzle-orm';

import { db } from '.';
import { organizations, profiles } from './schema';

const orgs = [
  {
    name: 'One Project',
    slug: 'one-project',
    bio: 'One Project bio',
    mission:
      'To nurture a just transition to a regenerative democratic economy.',
    email: 'scott@oneproject.org',
    website: 'https://oneproject.org',
    domain: 'oneproject.org',
  },
  {
    name: 'Common',
    slug: 'common',
    bio: 'Common bio',
    mission: 'Bring organizations together.',
    email: 'hello@common.io',
    website: 'https://common.io',
    domain: 'common.io',
  },
];

for (const org of orgs) {
  const [existingProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.slug, org.slug))
    .limit(1);

  if (existingProfile) {
    console.log(`profile ${org.slug} already exists, skipping`);
    continue;
  }

  const [profile] = await db
    .insert(profiles)
    .values({
      name: org.name,
      slug: org.slug,
      email: org.email,
      bio: org.bio,
      mission: org.mission,
      website: org.website,
    })
    .returning();

  if (!profile) {
    throw new Error(`Failed to create profile for ${org.name}`);
  }

  await db.insert(organizations).values({
    profileId: profile.id,
    domain: org.domain,
  });

  console.log(`created ${org.name} (profile ${profile.id})`);
}

console.log('done');
process.exit(0);

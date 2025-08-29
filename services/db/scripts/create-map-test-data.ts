import { db } from '../index';
import { locations, profiles, individuals, organizations, individualsTerms, taxonomyTerms } from '../schema';
import { sql, eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';

// Truncate existing test data
async function truncateTestData() {
  console.log('Truncating existing test data...');
  
  // First clear the foreign key references by setting primaryLocationId to null for ALL profiles
  await db.update(profiles)
    .set({ primaryLocationId: null })
    .where(sql`primary_location_id IN (
      SELECT id FROM locations WHERE name LIKE '%Test%' OR name LIKE '%(Test)%'
    )`);
  
  // Delete test profiles and related data
  await db.delete(individualsTerms);
  await db.delete(individuals);
  await db.delete(organizations);
  
  // Delete test profiles (both individuals and organizations)
  await db.delete(profiles).where(sql`slug LIKE '%-test-%'`);
  
  // Delete test locations (those created for testing)
  await db.delete(locations).where(sql`name LIKE '%Test%' OR name LIKE '%(Test)%'`);
  
  console.log('Test data truncated');
}

// Generate realistic test data for the map feature
export async function createMapTestData() {
  console.log('Creating map test data...');
  
  // First truncate any existing test data
  await truncateTestData();

  // Check if taxonomy terms exist for focus areas
  const existingFocusAreas = await db.select().from(taxonomyTerms).limit(1);
  
  // If no taxonomy terms exist, we'll create some test ones
  // In a real implementation, these would come from the actual taxonomy system
  if (existingFocusAreas.length === 0) {
    console.log('Note: No taxonomy terms found. Focus areas will be linked to existing terms if available.');
  }

  // Create realistic locations (major cities) - mark as test data
  const cityLocations = [
    // North America
    { name: 'New York, NY (Test)', lat: 40.7128, lng: -74.0060 },
    { name: 'San Francisco, CA (Test)', lat: 37.7749, lng: -122.4194 },
    { name: 'Los Angeles, CA (Test)', lat: 34.0522, lng: -118.2437 },
    { name: 'Chicago, IL (Test)', lat: 41.8781, lng: -87.6298 },
    { name: 'Austin, TX (Test)', lat: 30.2672, lng: -97.7431 },
    { name: 'Seattle, WA (Test)', lat: 47.6062, lng: -122.3321 },
    { name: 'Boston, MA (Test)', lat: 42.3601, lng: -71.0589 },
    { name: 'Toronto, ON (Test)', lat: 43.6532, lng: -79.3832 },
    
    // Europe
    { name: 'London, UK (Test)', lat: 51.5074, lng: -0.1278 },
    { name: 'Berlin, Germany (Test)', lat: 52.5200, lng: 13.4050 },
    { name: 'Paris, France (Test)', lat: 48.8566, lng: 2.3522 },
    { name: 'Amsterdam, Netherlands (Test)', lat: 52.3676, lng: 4.9041 },
    { name: 'Barcelona, Spain (Test)', lat: 41.3851, lng: 2.1734 },
    
    // Asia
    { name: 'Tokyo, Japan (Test)', lat: 35.6762, lng: 139.6503 },
    { name: 'Singapore (Test)', lat: 1.3521, lng: 103.8198 },
    { name: 'Bangalore, India (Test)', lat: 12.9716, lng: 77.5946 },
  ];

  const createdLocations = [];
  for (const city of cityLocations) {
    const [location] = await db.insert(locations).values({
      name: city.name,
      placeId: `test-location-${city.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      location: sql`ST_SetSRID(ST_MakePoint(${city.lng}, ${city.lat}), 4326)`,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    }).returning();
    createdLocations.push(location);
  }
  console.log(`Created ${createdLocations.length} locations`);

  // Create sample organizations first - use valid orgType enum values
  const organizationTypes = [
    'nonprofit', 'forprofit', 'government', 'other'
  ];

  const createdOrganizations = [];
  for (let i = 0; i < 20; i++) {
    const orgType = faker.helpers.arrayElement(organizationTypes);
    const orgName = faker.company.name();
    const location = faker.helpers.arrayElement(createdLocations);
    
    const [profile] = await db.insert(profiles).values({
      name: orgName,
      title: `${orgType} Company`,
      bio: faker.company.catchPhrase(),
      primaryLocationId: location.id,
      entity_type: 'organization',
      slug: `org-${orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-test-${Date.now()}-${i}`,
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    }).returning();

    await db.insert(organizations).values({
      profileId: profile.id,
      orgType: orgType,
      website: faker.internet.url(),
      createdAt: sql`now()`,
      updatedAt: sql`now()`,
    });

    createdOrganizations.push(profile);
  }
  console.log(`Created ${createdOrganizations.length} organizations`);

  // Create ~50 individuals per location
  const jobTitles = [
    'Software Engineer', 'Product Manager', 'Data Scientist', 'UX Designer',
    'Marketing Manager', 'Sales Executive', 'Operations Manager', 'Research Scientist',
    'Business Analyst', 'Project Manager', 'DevOps Engineer', 'Quality Assurance',
    'Technical Writer', 'Support Specialist', 'Data Analyst', 'UI Developer',
    'Systems Administrator', 'Network Engineer', 'Security Analyst', 'Cloud Architect'
  ];

  const focusAreas = [
    'Technology', 'AI & Machine Learning', 'Data Science', 'Product Management',
    'UX/UI Design', 'Marketing', 'Finance', 'Healthcare', 'Education', 'Sustainability',
    'Climate Tech', 'Social Impact', 'Non-profit', 'Research', 'Entrepreneurship'
  ];

  let totalIndividuals = 0;
  
  for (const location of createdLocations) {
    const individualsCount = faker.number.int({ min: 45, max: 55 }); // ~50 per location
    
    for (let i = 0; i < individualsCount; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const fullName = `${firstName} ${lastName}`;
      const title = faker.helpers.arrayElement(jobTitles);
      const org = faker.helpers.arrayElement([...createdOrganizations, null]); // Some people without orgs
      
      const [profile] = await db.insert(profiles).values({
        name: fullName,
        title: title,
        bio: faker.person.bio(),
        primaryLocationId: location.id,
        entity_type: 'individual',
        slug: `individual-${fullName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-test-${Date.now()}-${totalIndividuals}`,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
      }).returning();

      await db.insert(individuals).values({
        profileId: profile.id,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
      });

      totalIndividuals++;
      
      // Add some focus areas for each individual
      const individualFocusAreas = faker.helpers.arrayElements(focusAreas, faker.number.int({ min: 1, max: 3 }));
      // Note: In a real implementation, we'd link these to actual taxonomy terms
    }
    
    console.log(`Created ${individualsCount} individuals for ${location.name}`);
  }

  console.log(`Total: Created ${totalIndividuals} individuals across ${createdLocations.length} locations`);
  console.log('Map test data generation complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createMapTestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error creating test data:', error);
      process.exit(1);
    });
}
/* eslint-disable antfu/no-top-level-await */
import { createServerClient } from '@supabase/ssr';
import dotenv from 'dotenv';
import { getTableName, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';
import { LinkType } from 'schema/tables/links.sql';
import { OrgType } from 'schema/tables/organizations.sql';

import { adminEmails } from '@op/core';

import * as schema from './schema/publicTables';

import { db } from '.';

import type { Table } from 'drizzle-orm';

// For local development, we need to load the .env.local file from the root of the monorepo
dotenv.config({
  override: true,
});

if (!process.env.DB_SEEDING) {
  throw new Error('You must set DB_SEEDING to "true" when truncating');
}

if (
  process.env.DATABASE_URL
  !== 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
) {
  throw new Error('You are truncating in production');
}

async function resetTable(
  database: typeof db,
  table: Table,
  schemaName?: string,
) {
  const tableName = getTableName(table);
  const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

  await database.execute(
    sql.raw(`TRUNCATE TABLE ${fullTableName} RESTART IDENTITY CASCADE`),
  );
}

// Reset public schema tables
for (const table of Object.values(schema).filter(
  value => value instanceof PgTable,
)) {
  await resetTable(db, table);
}

// Reset auth schema table
await resetTable(db, authUsers, 'auth');

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
  {
    cookieOptions: {},
    cookies: {
      getAll: async () => [],
      setAll: async () => {},
    },
  },
);

await supabase.storage.emptyBucket('assets');
await supabase.storage.emptyBucket('avatars');

for (const email of adminEmails) {
  // Create dev user in auth table
  const { error } = await supabase.auth.admin.createUser({
    email,
  });

  if (error) {
    throw new Error('Failed to create dev user');
  }
}

const seedOrgs = [
  {
    name: 'One Project',
    slug: 'one-project',
    description:
      'One Project collaborates with people to build tools, systems and support for the futures ahead. We build deep relationships with communities who share a vision for a new economy.We work alongside them to co- create social and digital infrastructure, and also offer material support to nurture a growing ecosystem of collective action.',
    mission:
      'To nurture a just transition to a regenerative democratic economy.',
    city: 'San Francisco',
    state: 'CA',
    isOfferingFunds: true,
    isReceivingFunds: true,
    email: 'info@oneproject.org',
    website: 'https://oneproject.org',
    type: OrgType.NONPROFIT,
  },
  {
    name: 'New Economy Coalition',
    slug: 'new-economy-coalition',
    description: 'A test organization for New Economy Coalition',
    mission: 'Supporting sustainable economic reforms.',
    city: 'New York',
    state: 'NY',
    isOfferingFunds: false,
    isReceivingFunds: true,
    email: 'contact@necoalition.org',
    website: 'https://necoalition.org',
    type: OrgType.NONPROFIT,
  },
  {
    name: 'People Powered',
    slug: 'people-powered',
    description: 'A collaborative network for people empowerment.',
    mission: 'Empowering communities through shared projects.',
    city: 'Los Angeles',
    state: 'CA',
    isOfferingFunds: true,
    isReceivingFunds: false,
    email: 'contact@peoplepowered.org',
    website: 'https://peoplepowered.org',
    type: OrgType.NONPROFIT,
  },
  {
    name: 'Maria Fund',
    slug: 'maria-fund',
    description: 'Funding grassroots initiatives.',
    mission: 'Investing in community strengths.',
    city: 'Chicago',
    state: 'IL',
    isOfferingFunds: false,
    isReceivingFunds: true,
    email: 'hello@mariafund.org',
    website: 'https://mariafund.org',
    type: OrgType.NONPROFIT,
  },
  {
    name: 'Seed Commons',
    slug: 'seed-commons',
    description: 'A seed funding organization.',
    mission: 'Growing sustainable projects from the ground up.',
    city: 'Austin',
    state: 'TX',
    isOfferingFunds: false,
    isReceivingFunds: true,
    email: 'info@seedcommons.org',
    website: 'https://seedcommons.org',
    type: OrgType.NONPROFIT,
  },
  {
    name: 'CED',
    slug: 'ced',
    description: 'Center for Economic Development.',
    mission: 'Promoting equitable financial strategies.',
    city: 'Seattle',
    state: 'WA',
    isOfferingFunds: false,
    isReceivingFunds: true,
    email: 'contact@ced.org',
    website: 'https://ced.org',
    type: OrgType.NONPROFIT,
  },
  {
    name: 'Boston Ujima Project',
    slug: 'boston-ujima-project',
    description: 'A local Boston project for community involvement.',
    mission: 'Driving neighborhood change through activism.',
    city: 'Boston',
    state: 'MA',
    isOfferingFunds: false,
    isReceivingFunds: true,
    email: 'contact@bostonujima.org',
    website: 'https://bostonujima.org',
    type: OrgType.NONPROFIT,
  },
];

const randomPosts = [
  'Excited to announce our new "Small Business Recovery Fund" launching next month! We\'ve secured $2.5M to provide zero-interest loans to local businesses affected by the economic downturn. Applications open May 15th. #EconomicRecovery #SupportSmallBusiness',

  'Today we welcomed 150 participants to our annual Economic Opportunity Summit, with keynote speaker Dr. Sarah Chen discussing innovative approaches to reducing wealth inequality in urban centers. Thank you to everyone who joined us for this important conversation!',

  'JUST RELEASED: Our Q1 2025 Economic Impact Report shows our microfinance initiative has helped create 340 jobs across the region, with 68% of loans going to women-owned businesses. Download the full report at our website. #EconomicDevelopment #Microfinance',

  'Registration is now open for our free Financial Literacy Workshop Series! Sessions include budgeting basics, understanding credit, retirement planning, and small business financials. Reserve your spot: [link] #FinancialEducation',

  'We\'re thrilled to partner with @CityCommCollege on their new Workforce Development Program. Together, we\'ll provide specialized training to 500+ individuals in high-demand fields over the next year. #SkillsTraining #WorkforceDevelopment',

  'Our Executive Director Maya Johnson is testifying before the State Economic Committee today on the impact of affordable housing on economic mobility. Watch the livestream at 2PM on our website. #PolicyAdvocacy #AffordableHousing',

  'GRANT OPPORTUNITY: Applications for our Community Economic Innovation Grants are due April 30th! We\'re offering up to $50,000 for community-based initiatives that create sustainable economic opportunities. Details at [link] #CommunityDevelopment',

  'The results are in! Our Youth Entrepreneurship Challenge had over 200 submissions from high school students across the region. Congratulations to Westside High team "GreenGrowth" for their sustainable urban farming initiative! #YouthEntrepreneurs',

  'This month marks 15 years of serving our community! Since 2010, we\'ve invested $45M in economic development projects, supported 3,200+ small businesses, and helped create over 12,000 jobs. Thank you for being part of this journey! #Anniversary #Impact',

  'Join us for our upcoming webinar: "Navigating Economic Uncertainty: Strategies for Non-Profits" featuring expert panel with economists from @NationalEconCenter and community leaders. April 23rd, 12-1:30PM EST. Register: [link] #NonprofitLeadership',

  'We\'ve just released our new research brief on the gig economy\'s impact on local communities. Key finding: 37% of gig workers rely on multiple platforms to achieve living wages. Read more: [link] #GigEconomy #EconomicResearch',

  'Congratulations to the 25 graduates of our Women\'s Business Accelerator program! These remarkable entrepreneurs have developed business plans that will create an estimated 120+ jobs in our community. #WomenInBusiness #Entrepreneurship',

  'COMMUNITY ALERT: Emergency relief funds are now available for small businesses affected by last month\'s downtown flooding. Applications processed within 48 hours. Contact our office for assistance. #DisasterRelief #SmallBusinessSupport',

  'We\'re hiring! Join our team as Research Director and help shape economic policy recommendations that create more equitable communities. Application deadline: May 5th. Full job description at our careers page. #JobOpportunity #EconomicPolicy',

  'Thank you to the 300+ volunteers who made our Community Resource Fair possible yesterday! Over 1,200 residents connected with employment opportunities, financial services, and housing resources. #CommunityEngagement #EconomicOpportunity',

  'NEW REPORT: Our study on rural economic development shows that broadband access is the #1 factor in attracting new businesses to underserved communities. Read our policy recommendations: [link] #RuralDevelopment #DigitalDivide',

  'Celebrating a milestone: Our microloan program just funded its 1,000th entrepreneur! These loans, averaging $12,000, have helped create sustainable businesses with a 92% success rate after two years. #Microfinance #EntrepreneurshipWorks',

  'Join us next Saturday for our Neighborhood Economic Summit where residents, business owners, and local officials will collaborate on a 5-year development plan for the East District. Free childcare provided. #CommunityPlanning #LocalEconomies',

  'We\'re proud to announce our new Green Business Initiative, offering specialized training and grant funding for entrepreneurs focused on sustainable solutions. First cohort starts June 1st! Apply by May 15th. #GreenBusiness #SustainableEconomy',

  'Our 2024 Impact Survey results are in: 87% of program participants report improved financial stability, with median household savings increasing by $3,200. This is why we do what we do! #MeasurableImpact #FinancialSecurity',
];

// setup mock organizations
await Promise.all(
  seedOrgs.map(data =>
    db.transaction(async (tx) => {
      const [org] = await tx
        .insert(schema.organizations)
        .values(data)
        .returning({ id: schema.organizations.id });

      if (org?.id) {
        // add links
        await tx.insert(schema.links).values([
          ...(data.isOfferingFunds
            ? [
                {
                  href: data.website,
                  name: data.name,
                  type: LinkType.OFFERING,
                  organizationId: org.id,
                },
              ]
            : []),
          ...(data.isReceivingFunds
            ? [
                {
                  href: data.website,
                  name: data.name,
                  type: LinkType.RECEIVING,
                  organizationId: org.id,
                },
              ]
            : []),
        ]);

        await Promise.all(
          Array.from({ length: Math.floor(Math.random() * 8) }).map(
            async () => {
              const postContent = randomPosts[
                Math.floor(Math.random() * randomPosts.length)
              ] as string;
              const [post] = await tx
                .insert(schema.posts)
                .values({
                  content: postContent,
                })
                .returning({ id: schema.posts.id });

              if (post) {
                await tx.insert(schema.postsToOrganizations).values({
                  postId: post.id,
                  organizationId: org.id,
                });
              }
            },
          ),
        );
      }
    }),
  ),
);

await db.$client.end();

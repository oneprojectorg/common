/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The pile the Current Phase list filters, sorts and searches. Twenty-four of
 * them, because the toolbar's whole job is what you do when there are more than
 * fit on a screen — six would have made every control a no-op.
 *
 * Two dimensions, deliberately uneven: a category every proposal has, and a
 * neighbourhood spread thinly enough that combining the two returns a handful
 * rather than everything.
 */
export interface PrototypeProposal {
  id: string;
  title: string;
  budget: number;
  category: string;
  neighborhood: string;
  author: string;
  description: string;
  likes: number;
  follows: number;
  comments: number;
  /** ISO day. Sorting is by this, not by array order. */
  submittedAt: string;
  badge?: { label: string; variant: 'success' | 'warning' | 'inactive' };
}

/** The dimensions the filter popover offers, in the order it offers them. */
export const PROPOSAL_DIMENSIONS = [
  { key: 'category', label: 'Category' },
  { key: 'neighborhood', label: 'Neighborhood' },
] as const;

export type DimensionKey = (typeof PROPOSAL_DIMENSIONS)[number]['key'];

export const PROPOSALS: PrototypeProposal[] = [
  {
    id: 'p-01',
    title: 'Shade trees along Alameda Ave',
    budget: 42000,
    category: 'Parks & green space',
    neighborhood: 'Riverside',
    author: 'Marisol Ortega',
    description:
      'Forty street trees between 3rd and 9th, on the stretch with no cover at all. The block hits 104°F in August and the bus stop has no shelter.',
    likes: 48,
    follows: 12,
    comments: 9,
    submittedAt: '2026-03-14',
  },
  {
    id: 'p-02',
    title: 'Sidewalk repair on East End side streets',
    budget: 96000,
    category: 'Streets & mobility',
    neighborhood: 'East End',
    author: 'Aisha Bello',
    description:
      'Replacing the worst 40 panels, prioritised by the sections flagged in last year’s accessibility audit. Two of them are impassable in a wheelchair.',
    likes: 37,
    follows: 8,
    comments: 6,
    submittedAt: '2026-03-12',
  },
  {
    id: 'p-03',
    title: 'Bus shelters on the 14 route',
    budget: 55000,
    category: 'Streets & mobility',
    neighborhood: 'Riverside',
    author: 'Grace Lin',
    description:
      'Five shelters with seating and a timetable at the stops with the longest waits.',
    likes: 29,
    follows: 7,
    comments: 4,
    submittedAt: '2026-03-11',
  },
  {
    id: 'p-04',
    title: 'Community garden at the Fulton lot',
    budget: 31000,
    category: 'Parks & green space',
    neighborhood: 'Northgate',
    author: 'Lorena Reyes',
    description:
      'Raised beds, a tool shed and a standpipe on the vacant lot the city already owns. Forty households on the waiting list at the nearest allotment.',
    likes: 44,
    follows: 15,
    comments: 8,
    submittedAt: '2026-03-10',
  },
  {
    id: 'p-05',
    title: 'Crosswalk lighting at school corners',
    budget: 68000,
    category: 'Safety & lighting',
    neighborhood: 'Harbor View',
    author: 'Tomás Rivera',
    description:
      'Lit crossings at the six corners inside the school zone, all of which are unlit between October and March.',
    likes: 71,
    follows: 24,
    comments: 17,
    submittedAt: '2026-03-09',
    badge: { label: 'Shortlisted', variant: 'success' },
  },
  {
    id: 'p-06',
    title: 'Free swim lessons at the rec pool',
    budget: 24000,
    category: 'Community programs',
    neighborhood: 'East End',
    author: 'Odette Ka',
    description:
      'Two terms of lessons for under-12s, taught by the pool’s own staff, at no cost to families.',
    likes: 63,
    follows: 19,
    comments: 12,
    submittedAt: '2026-03-08',
  },
  {
    id: 'p-07',
    title: 'Lighting for the Northside skate park',
    budget: 18500,
    category: 'Safety & lighting',
    neighborhood: 'Northside',
    author: 'Daniel Kim',
    description:
      'Six pole-mounted LED fixtures so the park is usable after dark. Right now it empties out at 6pm through the winter.',
    likes: 61,
    follows: 20,
    comments: 14,
    submittedAt: '2026-03-07',
    badge: { label: 'Shortlisted', variant: 'success' },
  },
  {
    id: 'p-08',
    title: 'Community fridge and pantry',
    budget: 12000,
    category: 'Community programs',
    neighborhood: 'Downtown',
    author: 'Tomás Rivera',
    description:
      'A stocked fridge outside the library, run with the food bank. Covers the unit, the electrical work and a year of maintenance.',
    likes: 88,
    follows: 31,
    comments: 22,
    submittedAt: '2026-03-06',
  },
  {
    id: 'p-09',
    title: 'Protected bike lane on Cordell',
    budget: 120000,
    category: 'Streets & mobility',
    neighborhood: 'Downtown',
    author: 'Priya Raman',
    description:
      'Kerb-separated lane for the mile between the station and the college, replacing the painted one nobody uses.',
    likes: 94,
    follows: 40,
    comments: 31,
    submittedAt: '2026-03-05',
  },
  {
    id: 'p-10',
    title: 'Playground resurfacing at Hillcrest',
    budget: 47000,
    category: 'Parks & green space',
    neighborhood: 'Northside',
    author: 'Lena Brandt',
    description:
      'The rubber surface has split across most of the under-fives area and the fall height no longer passes inspection.',
    likes: 39,
    follows: 11,
    comments: 5,
    submittedAt: '2026-03-04',
  },
  {
    id: 'p-11',
    title: 'Evening ESL classes at the library',
    budget: 28000,
    category: 'Community programs',
    neighborhood: 'East End',
    author: 'Sofia Marchetti',
    description:
      'Three levels, two evenings a week, run through the winter with childcare in the next room.',
    likes: 57,
    follows: 22,
    comments: 13,
    submittedAt: '2026-03-03',
  },
  {
    id: 'p-12',
    title: 'Street lighting on the river path',
    budget: 82000,
    category: 'Safety & lighting',
    neighborhood: 'Riverside',
    author: 'Lorena Reyes',
    description:
      'Low bollard lighting along the two unlit miles, specified to keep the spill off the water for the herons.',
    likes: 51,
    follows: 16,
    comments: 10,
    submittedAt: '2026-03-02',
  },
  {
    id: 'p-13',
    title: 'Traffic calming on Beaumont',
    budget: 64000,
    category: 'Streets & mobility',
    neighborhood: 'Harbor View',
    author: 'Ines Duarte',
    description:
      'Raised tables at four junctions on the through-route drivers use to skip the arterial.',
    likes: 33,
    follows: 9,
    comments: 7,
    submittedAt: '2026-03-01',
  },
  {
    id: 'p-14',
    title: 'Pocket park on the Ferris triangle',
    budget: 39000,
    category: 'Parks & green space',
    neighborhood: 'Downtown',
    author: 'Marisol Ortega',
    description:
      'Benches, planting and a drinking fountain on the traffic island nobody can currently reach on foot.',
    likes: 46,
    follows: 14,
    comments: 9,
    submittedAt: '2026-02-28',
  },
  {
    id: 'p-15',
    title: 'Repair grants for shopfront awnings',
    budget: 35000,
    category: 'Community programs',
    neighborhood: 'Northgate',
    author: 'Hassan Yilmaz',
    description:
      'Small matched grants to the twelve independent shops on the parade, capped at three thousand each.',
    likes: 27,
    follows: 6,
    comments: 4,
    submittedAt: '2026-02-27',
  },
  {
    id: 'p-16',
    title: 'Alley lighting behind Vernon Row',
    budget: 21000,
    category: 'Safety & lighting',
    neighborhood: 'East End',
    author: 'Grace Lin',
    description:
      'Wall-mounted fixtures down the service alley residents avoid after dark.',
    likes: 42,
    follows: 13,
    comments: 8,
    submittedAt: '2026-02-26',
  },
  {
    id: 'p-17',
    title: 'Bus stop seating on the 9',
    budget: 16000,
    category: 'Streets & mobility',
    neighborhood: 'Northgate',
    author: 'Lorena Reyes',
    description:
      'Benches at the eleven stops that have none, on the route with the oldest ridership in the city.',
    likes: 35,
    follows: 10,
    comments: 6,
    submittedAt: '2026-02-25',
  },
  {
    id: 'p-18',
    title: 'Tree pit planting on Marsh Street',
    budget: 14000,
    category: 'Parks & green space',
    neighborhood: 'Harbor View',
    author: 'Devon Marsh',
    description:
      'Understory planting in the sixty empty tree pits, maintained by the street association for the first two years.',
    likes: 24,
    follows: 5,
    comments: 3,
    submittedAt: '2026-02-24',
  },
  {
    id: 'p-19',
    title: 'After-school programming at the rec centre',
    budget: 31000,
    category: 'Community programs',
    neighborhood: 'Northside',
    author: 'Omar Haddad',
    description:
      'Two staff and materials for a homework club, four afternoons a week, for the school year.',
    likes: 52,
    follows: 18,
    comments: 11,
    submittedAt: '2026-02-23',
  },
  {
    id: 'p-20',
    title: 'Speed cameras at the Dover junction',
    budget: 58000,
    category: 'Safety & lighting',
    neighborhood: 'Downtown',
    author: 'Priya Raman',
    description:
      'Two enforcement cameras at the junction with the highest injury count in the last three years.',
    likes: 68,
    follows: 21,
    comments: 26,
    submittedAt: '2026-02-22',
  },
  {
    id: 'p-21',
    title: 'Community orchard at Whitfield',
    budget: 26000,
    category: 'Parks & green space',
    neighborhood: 'Northgate',
    author: 'Lena Brandt',
    description:
      'Thirty fruit trees on the slope behind the allotments, with a path so the harvest is reachable without a car.',
    likes: 41,
    follows: 17,
    comments: 7,
    submittedAt: '2026-02-21',
  },
  {
    id: 'p-22',
    title: 'Kerb ramps across Harbor View',
    budget: 74000,
    category: 'Streets & mobility',
    neighborhood: 'Harbor View',
    author: 'Aisha Bello',
    description:
      'Dropped kerbs at the eighty corners still without them, taken in the order the audit ranked them.',
    likes: 59,
    follows: 23,
    comments: 15,
    submittedAt: '2026-02-20',
  },
  {
    id: 'p-23',
    title: 'Riverbank meadow restoration',
    budget: 53000,
    category: 'Parks & green space',
    neighborhood: 'Riverside',
    author: 'Wes Okafor',
    description:
      'Replacing four acres of mown grass with meadow, cut once a year instead of fortnightly.',
    likes: 47,
    follows: 19,
    comments: 12,
    submittedAt: '2026-02-19',
  },
  {
    id: 'p-24',
    title: 'Repair café at the community hall',
    budget: 9000,
    category: 'Community programs',
    neighborhood: 'Riverside',
    author: 'Sofia Marchetti',
    description:
      'Tools, benches and insurance for a monthly session fixing bikes, clothes and small appliances.',
    likes: 36,
    follows: 14,
    comments: 9,
    submittedAt: '2026-02-18',
  },
];

/** The values a dimension actually takes, in the order they first appear. */
export function dimensionValues(key: DimensionKey): string[] {
  return [...new Set(PROPOSALS.map((proposal) => proposal[key]))];
}

/** "$31,000" — the one number every proposal carries, written the one way. */
export function formatBudget(budget: number): string {
  return `$${budget.toLocaleString('en-US')}`;
}

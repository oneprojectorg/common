/**
 * Mock overview content for the decision Overview tab. Shaped like the future
 * `instanceData.overview` object so swapping to real data is a one-line change
 * at the read site in DecisionOverview.
 */
export interface DecisionOverviewData {
  /** Hero headline. Falls back to `instance.name` (see DecisionOverview). */
  headline?: string;
  /** Hero subhead. No fallback — omitted entirely when absent. */
  subhead?: string;
  /** TipTap-generated HTML for the About section. Falls back to `instance.description`. */
  content?: string;
}

export const decisionOverviewMock: DecisionOverviewData = {
  headline: 'Our voice, our choice',
  subhead:
    'Columbus residents are deciding how to invest $9 million in capital improvements across nine council districts.',
  content: [
    "<p>Each of Columbus's nine council districts has $1 million to allocate toward capital improvements — physical projects like park upgrades, sidewalk repairs, community centers, and public art. Over the course of 2026, residents will decide together how that money gets spent.</p>",
    '<p>The process moves through four phases. First, anyone living, working, or going to school in Columbus can submit ideas for their district. Then, budget delegates — residents trained by the steering committee — review the ideas and refine them into a ballot of feasible project proposals, working with city staff to confirm scope and cost.</p>',
    '<p>In the fall, residents vote on the proposals they want funded. Winning projects move into construction in 2027.</p>',
    "<p>The whole process is run by a community steering committee, not by City Hall — designed to keep decision-making in residents' hands.</p>",
  ].join(''),
};

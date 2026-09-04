import {
  ReviewResultCard,
  ReviewResultNote,
  ReviewResultOption,
  ReviewResultText,
} from '@op/sense/ReviewResultCard';
import type { Meta, StoryObj } from '@storybook/react-vite';

/**
 * A submitted answer to one review criterion, assembled from four parts:
 *
 * - `ReviewResultCard` — the bordered shell, which only stacks its children
 * - `ReviewResultOption` — a picked option: serif title, authored explanation
 * - `ReviewResultText` — a written answer, where the criterion wanted prose
 * - `ReviewResultNote` — the reviewer's note, muted, and drawing its own rule
 *
 * Each story is a worked assembly — read its source, not the props table: the
 * card takes children, so there are no args to tweak. Copy throughout is a
 * participatory-budgeting feasibility review, at the length real rubrics run
 * to.
 */
const meta: Meta<typeof ReviewResultCard> = {
  title: 'Composites/ReviewResultCard',
  component: ReviewResultCard,
  subcomponents: {
    ReviewResultOption,
    ReviewResultText,
    ReviewResultNote,
  },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ReviewResultCard>;

/** The answer on its own — an option with nothing to explain, over a note. */
export const SingleAnswer: Story = {
  render: () => (
    <ReviewResultCard>
      <ReviewResultOption title="Yes" />
      <ReviewResultNote>
        Reached the submitter by phone on the 14th; they are open to a reduced
        scope.
      </ReviewResultNote>
    </ReviewResultCard>
  ),
};

/** The common case: the picked option carries the rubric's own explanation. */
export const AnswerWithExplanation: Story = {
  render: () => (
    <ReviewResultCard>
      <ReviewResultOption
        title="Maybe"
        description="Jurisdiction is shared across multiple city departments or requires formal inter-agency agreements (e.g., roadway work that intersects a parks trail)."
      />
      <ReviewResultNote>
        Parks owns the trail, but the drainage work sits with water and power —
        this needs an inter-agency agreement.
      </ReviewResultNote>
    </ReviewResultCard>
  ),
};

/** A multi-select: one option per selection, stacked in the one card. */
export const MultipleAnswers: Story = {
  render: () => (
    <ReviewResultCard>
      <ReviewResultOption
        title="Department of Recreation and Parks"
        description="Park upgrades, trail connections, athletic facilities, trees, playground equipment"
      />
      <ReviewResultOption
        title="Department of Water and Power"
        description="Stormwater management, green infrastructure, street lighting power, water/sewer improvements"
      />
      <ReviewResultNote>
        Two departments have to coordinate here, which is what pushes the
        timeline past 18 months.
      </ReviewResultNote>
    </ReviewResultCard>
  ),
};

/** Prose where the criterion asked for prose — no option above it. */
export const TextAnswer: Story = {
  render: () => (
    <ReviewResultCard>
      <ReviewResultText>
        Limit the installation to the 3-block stretch between Main St and Oak
        St. The remainder of the corridor sits on county right-of-way and would
        have to be a separate project.
      </ReviewResultText>
      <ReviewResultNote>
        Worth confirming the boundary with the county before this advances.
      </ReviewResultNote>
    </ReviewResultCard>
  ),
};

/**
 * An unanswered criterion the reviewer still commented on. The note is the
 * card's first child, so it draws no rule — nothing sits above it to separate.
 */
export const NoteOnly: Story = {
  render: () => (
    <ReviewResultCard>
      <ReviewResultNote>
        Skipping this one — the submission does not say which department would
        own the work.
      </ReviewResultNote>
    </ReviewResultCard>
  ),
};

/** No note: the answer alone, with no rule under it. */
export const WithoutNote: Story = {
  render: () => (
    <ReviewResultCard>
      <ReviewResultOption
        title="Yes"
        description="The project creates, acquires, or improves a long-term physical asset (useful life of 5+ years) on public property or right-of-way, in line with the city capital funding policy."
      />
    </ReviewResultCard>
  ),
};

/**
 * Reviewer-authored parts resolve their own direction, template-authored ones
 * follow the document: an Arabic note under an English option starts on the
 * right while the option above it stays left.
 */
export const MixedDirection: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <ReviewResultCard>
        <ReviewResultOption
          title="Maybe"
          description="Jurisdiction is shared across multiple city departments or requires formal inter-agency agreements."
        />
        <ReviewResultNote>
          الحديقة تتبع إدارة المتنزهات، لكن أعمال الصرف تتبع إدارة المياه
          والطاقة — نحتاج اتفاقية بين الإدارتين.
        </ReviewResultNote>
      </ReviewResultCard>
      <ReviewResultCard>
        <ReviewResultText>
          نوصي بقصر التنفيذ على المقطع الواقع بين شارع مين وشارع أوك، لأن بقية
          الممر تقع خارج حدود المدينة.
        </ReviewResultText>
        <ReviewResultNote>
          Translated for the record; the reviewer wrote in Arabic.
        </ReviewResultNote>
      </ReviewResultCard>
    </div>
  ),
};

/** Authored copy keeps its line breaks: `whitespace-pre-wrap`, not collapsed. */
export const AuthoredLineBreaks: Story = {
  render: () => (
    <ReviewResultCard>
      <ReviewResultOption
        title="Maybe"
        description={
          'Deliverable within 18 months:\nresurfacing the path and replacing the two damaged culverts.\n\nNot deliverable in that window:\nthe lighting run, which needs a utility easement the city does not hold yet.'
        }
      />
      <ReviewResultNote>
        Splitting the answer because the two halves have different owners.
      </ReviewResultNote>
    </ReviewResultCard>
  ),
};

/**
 * Mobile width with the longest content we expect — the designer flagged it as
 * the case to watch.
 */
export const LongContentOnMobile: Story = {
  render: () => (
    <div className="w-full max-w-xs">
      <ReviewResultCard>
        <ReviewResultOption
          title="No"
          description="The estimated minimum cost significantly exceeds $1,000,000 and cannot be broken down into standalone phases."
        />
        <ReviewResultNote>
          Both the design estimate and the contingency line are missing, and the
          construction figure alone is already over the cap, so there is no
          phasing that brings this under $1,000,000.
        </ReviewResultNote>
      </ReviewResultCard>
    </div>
  ),
};

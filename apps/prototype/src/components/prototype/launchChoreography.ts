/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * Every duration and delay in the launch sequence, in one place. The sequence
 * spans a modal and a page, and tuning it means moving beats relative to each
 * other — hunting the numbers down across two component trees is how a
 * choreography drifts out of time with itself.
 *
 * Milliseconds throughout. The CSS side reads these through custom properties
 * set on the page root, so there is exactly one source for both.
 */
export const LAUNCH = {
  /** Spinner on the Launch button before the modal changes. */
  commitHold: 700,
  /** The modal's own height morph, form → confirmation. */
  morph: 420,
  morphEasing: 'cubic-bezier(0.22, 0.9, 0.3, 1)',
  /** The form leaving: opacity first, transform a little behind it. */
  formFadeOut: 260,
  formDriftOut: 320,
  /** The confirmation assembling, top to bottom. */
  riseIn: 320,
  checkPop: 420,
  checkPopDelay: 180,
  ringPulse: 900,
  ringPulseDelay: 420,
  stagger: [320, 400, 470, 540, 620] as const,
  /** How long `Copied` stays before the button says `Copy` again. */
  copiedFor: 1600,

  /** The modal's standard exit, then the page turns over. */
  modalExit: 200,
  pageFlipDelay: 240,

  /* The page sequence. Nothing enters or leaves layout instantly: anything
     appearing or disappearing animates its own height, so the content around it
     glides rather than jumping. */
  headerCrossfade: 350,
  /* After the draft bar has gone, not over the top of it. Overlapping the two
     read as the live bar arriving and then the draft controls being removed —
     the wrong way round, and it looked like a correction. */
  headerLiveDelay: 320,
  titleTint: 700,
  heroHeight: 480,
  heroHeightDelay: 300,
  heroButtons: 400,
  heroButtonsDelay: 520,
  chipSpace: 380,
  chipSpaceDelay: 450,
  chipPop: 380,
  chipPopDelay: 650,
  addPhaseHeight: 350,
  addPhaseOpacity: 250,
  editAffordance: 300,
  editAffordanceDelays: [800, 900] as const,
  /* The rail's fill changing hands: the running phase takes it while the phase
     that held it in the draft gives it up. Both on the same clock, so it reads
     as one fill moving rather than two cards changing colour. */
  /* The fill and the text turning. First, and on its own: the card is seen to
     become the live card before it makes room for anything. */
  phaseFill: 500,
  /* The chevron going, over the same window — the one thing the card loses. */
  phaseArrow: 300,
  /* The rail swaps every card treatment at once — editing cells for resting
     cards, and the add-a-phase row leaves — so its height changes by more than
     any one beat accounts for. Rather than animate each piece, the column
     carries the difference: it holds the height it had and settles into the one
     it now measures, which absorbs whatever changed inside it. */
  railHeight: 520,
  /* Then the row the badge will sit in opens, and the badge lands in it. The
     order and the numbers are the reference prototype's: fill, then space, then
     the badge, each starting before the last has finished. */
  badgeSpace: 380,
  badgeSpaceDelay: 450,
  badgeIn: 380,
  badgeInDelay: 650,
} as const;

/** When the whole page sequence is done and the page is simply live. */
export const LAUNCH_SEQUENCE_MS =
  Math.max(
    LAUNCH.editAffordanceDelays[1] + LAUNCH.editAffordance,
    LAUNCH.badgeInDelay + LAUNCH.badgeIn,
  ) + 100;

/**
 * The constants as CSS custom properties, spread onto the page root. Keeps the
 * keyframes in the stylesheet and the numbers here.
 */
export const LAUNCH_CSS_VARS = {
  '--launch-header': `${LAUNCH.headerCrossfade}ms`,
  '--launch-header-delay': `${LAUNCH.headerLiveDelay}ms`,
  '--launch-title': `${LAUNCH.titleTint}ms`,
  '--launch-hero-height': `${LAUNCH.heroHeight}ms`,
  '--launch-hero-height-delay': `${LAUNCH.heroHeightDelay}ms`,
  '--launch-hero-buttons': `${LAUNCH.heroButtons}ms`,
  '--launch-hero-buttons-delay': `${LAUNCH.heroButtonsDelay}ms`,
  '--launch-chip-space': `${LAUNCH.chipSpace}ms`,
  '--launch-chip-space-delay': `${LAUNCH.chipSpaceDelay}ms`,
  '--launch-chip-pop': `${LAUNCH.chipPop}ms`,
  '--launch-chip-pop-delay': `${LAUNCH.chipPopDelay}ms`,
  '--launch-add-phase-height': `${LAUNCH.addPhaseHeight}ms`,
  '--launch-add-phase-opacity': `${LAUNCH.addPhaseOpacity}ms`,
  '--launch-edit': `${LAUNCH.editAffordance}ms`,
  '--launch-edit-a': `${LAUNCH.editAffordanceDelays[0]}ms`,
  '--launch-edit-b': `${LAUNCH.editAffordanceDelays[1]}ms`,
  '--launch-phase-fill': `${LAUNCH.phaseFill}ms`,
  '--launch-phase-arrow': `${LAUNCH.phaseArrow}ms`,
  '--launch-badge-space': `${LAUNCH.badgeSpace}ms`,
  '--launch-badge-space-delay': `${LAUNCH.badgeSpaceDelay}ms`,
  '--launch-badge-in': `${LAUNCH.badgeIn}ms`,
  '--launch-badge-in-delay': `${LAUNCH.badgeInDelay}ms`,
} as React.CSSProperties;

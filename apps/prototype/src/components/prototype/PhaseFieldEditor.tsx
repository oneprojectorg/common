'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@op/sense/Accordion';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Field, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@op/sense/Popover';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Separator } from '@op/sense/Separator';
import { DragHandle, Sortable } from '@op/sense/Sortable';
import type { SortableItemControls } from '@op/sense/Sortable';
import { Switch } from '@op/sense/Switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import { type ReactNode, useId, useMemo, useState } from 'react';
import {
  LuEyeOff,
  LuGripVertical,
  LuInfo,
  LuLock,
  LuPlus,
  LuSettings,
  LuTrash2,
  LuUpload,
  LuX,
} from 'react-icons/lu';

import { CharacterCountInput } from './CharacterCountInput';

/** Said in the popover and on the row's own badge — one sentence, one meaning. */
const CONFIDENTIAL_HINT =
  'Answers stay confidential \u2014 only process admins and reviewers can see them.';

import {
  CURRENCIES,
  DESCRIPTION_LIMIT,
  FIELD_NAME_LIMIT,
  LOCATION_MODES,
  LOCATION_MODE_META,
  type LocationBounds,
  NAME_LIMIT,
  RATING_MAXIMUMS,
  type RatingScale,
} from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * One editor behind all three builders — questions, criteria, proposal fields —
 * with the wording adapted per context. Description is folded away behind a
 * toggle because the common case is a name and an answer type: two decisions
 * rather than four.
 */
export function PhaseFieldEditor<Format extends string>({
  label,
  description,
  format,
  optional,
  locked,
  nameLabel,
  formatLabel,
  formats,
  settings,
  isConfidential,
  allowsMultiple,
  onLabelChange,
  onDescriptionChange,
  onFormatChange,
  onOptionalChange,
  onConfidentialChange,
  onMultipleChange,
  onDelete,
}: {
  label: string;
  description?: string;
  optional: boolean;
  /** Carried over from an earlier form: shown, not editable. */
  locked?: boolean;
  nameLabel: string;
  /**
   * The answer type, and the picker for it. Left off together when the row's
   * answers are fixed — a recommendation asks the same thing every time, so
   * offering a choice would be offering one that doesn't exist. The name field
   * takes the whole row in their place.
   */
  format?: Format;
  formatLabel?: string;
  formats?: readonly Format[];
  /**
   * Whatever the chosen type needs configured — the answers for a choice, the
   * bounds for a location, the ends of a rating. Which one is the caller's
   * business: questions and criteria don't share a single type.
   */
  settings?: ReactNode;
  /** Only questions can be confidential — a criterion has no answer to hide. */
  isConfidential?: boolean;
  /** Multiple choice only. Passing the handler is what offers the toggle. */
  allowsMultiple?: boolean;
  onLabelChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFormatChange?: (value: Format) => void;
  onOptionalChange: (value: boolean) => void;
  /** Passing this is what puts the Confidential toggle in Settings. */
  onConfidentialChange?: (value: boolean) => void;
  /** Passing this is what puts Multiple selections in Settings. */
  onMultipleChange?: (value: boolean) => void;
  onDelete: () => void;
}) {
  const id = useId();
  const [showDescription, setShowDescription] = useState(
    Boolean(description?.length),
  );
  /* An example of the kind of thing this asks, rather than the word
     "placeholder" — what an empty field most needs to say is what a filled one
     would look like. Keyed off the answer type, which is what shapes it. */
  const namePlaceholder =
    NAME_PLACEHOLDER[format as string] ??
    (formatLabel === 'Scored by'
      ? 'e.g. Is the budget realistic?'
      : 'e.g. What are you proposing?');

  if (locked) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-4">
        <LuLock
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-base font-strong">{label}</span>
          <span className="text-sm text-muted-foreground">
            Carried over from an earlier form — people already answered it.
          </span>
        </div>
      </div>
    );
  }

  return (
    /* The frame's own rhythm inside a card, which is not a single gap: 12 to the
       description affordance, 24 to the type's settings, 28 to the rule, 16 to
       the actions. The base gap is the 12, and the rest add to it. */
    <div className="flex flex-col gap-3">
      {/* The two decisions that make a question, side by side: what it asks and
          what kind of answer it takes. Everything else is optional and sits
          below, or behind `Settings`. Two thirds to one, on the frame's own
          10px column gap. */}
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Field
          className={cn('min-w-0', formats ? 'sm:col-span-2' : 'sm:col-span-3')}
        >
          {/* No asterisk here: whether the question is required is a fact about
              the question, so it is marked once, on the row's own title. */}
          <FieldLabel htmlFor={`${id}-name`}>{nameLabel}</FieldLabel>
          <CharacterCountInput
            id={`${id}-name`}
            value={label}
            limit={FIELD_NAME_LIMIT}
            fieldLabel={nameLabel}
            placeholder={namePlaceholder}
            onChange={(event) => onLabelChange(event.target.value)}
          />
        </Field>

        {formats ? (
          <Field className="w-full min-w-0">
            <FieldLabel htmlFor={`${id}-format`}>{formatLabel}</FieldLabel>
            <Select
              value={format}
              onValueChange={(next) => {
                const match = formats.find((option) => option === next);

                if (match) {
                  onFormatChange?.(match);
                }
              }}
            >
              <SelectTrigger id={`${id}-format`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formats.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </div>

      {showDescription ? (
        <Field>
          <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
          {/* A line, not a box: this is the hint under a question, and a
              textarea invited an essay nobody reads on the form. Capped at the
              product's own limit for the same field, so the count is a real
              constraint rather than prototype decoration. */}
          <CharacterCountInput
            id={`${id}-description`}
            value={description ?? ''}
            limit={DESCRIPTION_LIMIT}
            fieldLabel="Description"
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </Field>
      ) : (
        <Button
          variant="link"
          size="inline"
          // Flush with the field above it, but a control's full height: the
          // frame draws this as a 44px button with no side padding.
          className="h-11 w-fit gap-1.5"
          onClick={() => setShowDescription(true)}
        >
          <LuPlus className="size-4" aria-hidden />
          Add description
        </Button>
      )}

      {/* Settings that belong to the chosen type sit under it, so it reads as
          "this kind of answer, configured" rather than as more of the form.
          Further down than the description affordance is from the fields: 24,
          because this is a new block and that was the same one. */}
      {settings ? <div className="mt-3">{settings}</div> : null}

      <Separator className="mt-4" />

      {/* Required and Confidential are answered once and rarely revisited, so
          they live behind a button rather than taking a row of every card. What
          stays on the face is the type and the answer, which is what an admin
          is actually reading down the form. */}
      <div className="mt-1 flex items-center justify-between gap-3">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            <LuSettings className="size-4" aria-hidden />
            Settings
          </PopoverTrigger>
          <PopoverContent align="start" className="sense w-72">
            <div className="flex flex-col gap-4">
              <Field orientation="horizontal">
                <FieldLabel htmlFor={`${id}-required`}>Required</FieldLabel>
                <Switch
                  id={`${id}-required`}
                  className="ms-auto"
                  checked={!optional}
                  onCheckedChange={(checked) => onOptionalChange(!checked)}
                />
              </Field>

              {onConfidentialChange ? (
                <Field orientation="horizontal">
                  {/* The hint belongs to the label, so it sits against it — the
                      gap lives between the pair and the switch. */}
                  <span className="flex items-center gap-0">
                    <FieldLabel htmlFor={`${id}-confidential`}>
                      Confidential
                    </FieldLabel>
                    {/* A real button, not a bare icon: hover alone would keep
                        this from keyboard and touch. */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="hover:bg-transparent"
                            aria-label="What a confidential question means"
                          />
                        }
                      >
                        <LuInfo className="size-3.5" aria-hidden />
                      </TooltipTrigger>
                      <TooltipContent>{CONFIDENTIAL_HINT}</TooltipContent>
                    </Tooltip>
                  </span>
                  <Switch
                    id={`${id}-confidential`}
                    className="ms-auto"
                    checked={isConfidential ?? false}
                    onCheckedChange={onConfidentialChange}
                  />
                </Field>
              ) : null}

              {onMultipleChange ? (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor={`${id}-multiple`}>
                    Multiple selections
                  </FieldLabel>
                  <Switch
                    id={`${id}-multiple`}
                    className="ms-auto"
                    checked={allowsMultiple ?? false}
                    onCheckedChange={onMultipleChange}
                  />
                </Field>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="destructive" size="sm" onClick={onDelete}>
          <LuTrash2 className="size-4" aria-hidden />
          Delete
        </Button>
      </div>
    </div>
  );
}

/**
 * What a question of each type tends to ask. Written as an example rather than
 * an instruction: an admin reading `e.g. Which neighborhood is this for?` knows
 * both what to type and what shape it should take.
 */
const NAME_PLACEHOLDER: Record<string, string> = {
  Text: 'e.g. What are you proposing?',
  'Multiple choice': 'e.g. Which neighborhood is this for?',
  Location: 'e.g. Where would this go?',
  File: 'e.g. Attach a budget breakdown',
  'Rating scale': 'e.g. How feasible is this?',
  'Yes / No': 'e.g. Does this meet the eligibility rules?',
};

/**
 * The answers people pick from. Reordering is out of scope for the prototype;
 * what matters is that the list is real, because a Review phase groups by it.
 */
/** Stand-ins for the first few answers, so an empty list still reads as a list. */
const CHOICE_PLACEHOLDER = [
  'e.g. Riverside',
  'e.g. Northside',
  'e.g. East End',
];

export function ChoiceSettings({
  options,
  onChange,
}: {
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const id = useId();

  return (
    <SettingsBlock legend="Choices">
      {/* The rows are one group inside the block, so the 8px between them stays
          tighter than the 12 that separates them from the legend and the link. */}
      <div className="flex flex-col gap-2">
        {options.map((option, index) => (
          <div
            key={`${id}-option-${index}`}
            className="flex items-center gap-2"
          >
            {/* Reordering is out of scope, so the handle is a marker rather than
                a control: it says the list has an order without pretending to a
                drag the prototype doesn't do. The frame draws it at 24, matched
                to the row rather than to the text. */}
            <LuGripVertical
              className="size-6 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <Field className="min-w-0 flex-1">
              <FieldLabel htmlFor={`${id}-option-${index}`} className="sr-only">
                Choice {index + 1}
              </FieldLabel>
              <Input
                id={`${id}-option-${index}`}
                value={option}
                maxLength={NAME_LIMIT}
                placeholder={CHOICE_PLACEHOLDER[index] ?? `Option ${index + 1}`}
                onChange={(event) =>
                  onChange(
                    options.map((item, position) =>
                      position === index ? event.target.value : item,
                    ),
                  )
                }
              />
            </Field>
            {/* Below two choices it stops being a choice, so the last two can't
                be removed. */}
            <Button
              variant="outline"
              size="icon"
              aria-label={`Remove choice ${index + 1}`}
              disabled={options.length <= 2}
              onClick={() =>
                onChange(options.filter((_, position) => position !== index))
              }
            >
              <LuX className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="link"
        size="inline"
        className="h-11 w-fit gap-1.5"
        onClick={() => onChange([...options, ''])}
      >
        <LuPlus className="size-4" aria-hidden />
        Add option
      </Button>
    </SettingsBlock>
  );
}

/**
 * What an amount answer is asked in, and the most it may be. The currency
 * belongs to the question rather than to the answer: a form where every proposal
 * picked its own currency would collect numbers nobody could add up or compare,
 * so this is set once here and shown to everyone filling it in.
 *
 * A maximum is optional — plenty of processes ask what something costs without
 * capping it — so empty means no ceiling rather than zero.
 */
export function AmountSettings({
  currency,
  maxAmount,
  onCurrencyChange,
  onMaxAmountChange,
}: {
  currency: string;
  maxAmount?: number;
  onCurrencyChange: (next: string) => void;
  onMaxAmountChange: (next: number | undefined) => void;
}) {
  const id = useId();
  const locale = useLocale();
  /* "US Dollar (USD $)" — the reader's own name for the currency, then the code
     and symbol they will actually see on the form. `items` as well as the
     options: the trigger renders the value it was given, so without the map it
     reads `USD` while the list reads the whole name. */
  const labels = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'currency' });

    return Object.fromEntries(
      CURRENCIES.map(({ code, symbol }) => [
        code,
        `${names.of(code) ?? code} (${code} ${symbol})`,
      ]),
    );
  }, [locale]);

  return (
    <SettingsBlock legend="Amount">
      <Field>
        <FieldLabel htmlFor={`${id}-currency`}>Currency</FieldLabel>
        <Select
          value={currency}
          onValueChange={(next) => onCurrencyChange(String(next))}
          items={labels}
        >
          <SelectTrigger id={`${id}-currency`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {labels[option.code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor={`${id}-max`}>Max amount</FieldLabel>
        <Input
          id={`${id}-max`}
          // Not `type="number"`: the spinners are useless at this size and a
          // scroll over the field would change the answer.
          inputMode="decimal"
          value={maxAmount === undefined ? '' : String(maxAmount)}
          placeholder="No maximum"
          onChange={(event) => {
            const digits = event.target.value.replace(/[^\d.]/g, '');

            onMaxAmountChange(digits === '' ? undefined : Number(digits));
          }}
        />
      </Field>
    </SettingsBlock>
  );
}

/**
 * Where a location answer is allowed to be. Listed areas cover the common case
 * — a process run for a set of neighbourhoods — and a coordinate file covers the
 * boundary no postcode follows, like a watershed or a ward that was redrawn.
 */
export function LocationSettings({
  bounds,
  onChange,
}: {
  bounds: LocationBounds;
  onChange: (next: LocationBounds) => void;
}) {
  const id = useId();

  return (
    /* Fenced off and named: nobody has decided what bounding a location should
       actually mean here, so the box says out loud that this part was invented
       to fill the slot rather than designed to fill the need. */
    <div className="flex flex-col gap-3 rounded-lg border border-dotted border-input p-3">
      <Badge variant="warning" className="w-fit">
        claudio especial
      </Badge>
      <p className="text-sm text-muted-foreground">
        Generated to have something here &mdash; the real rules for where a
        location can be still need defining.
      </p>
      <SettingsBlock legend="Where can it be?">
        <RadioGroup
          value={bounds.mode}
          onValueChange={(next) => {
            const match = LOCATION_MODES.find((mode) => mode === next);

            if (match) {
              onChange({ ...bounds, mode: match });
            }
          }}
          className="gap-2"
        >
          {LOCATION_MODES.map((mode) => (
            <FieldLabel
              key={mode}
              htmlFor={`${id}-${mode}`}
              variant="box"
              className="bg-background"
            >
              <Field orientation="horizontal" className="items-start">
                <RadioGroupItem id={`${id}-${mode}`} value={mode} />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-base font-strong">
                    {LOCATION_MODE_META[mode].title}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {LOCATION_MODE_META[mode].helper}
                  </span>
                </div>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>

        {bounds.mode === 'areas' ? (
          <div className="flex flex-col gap-2">
            {bounds.areas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No areas yet &mdash; anything would be accepted.
              </p>
            ) : null}
            {bounds.areas.map((area, index) => (
              <div
                key={`${id}-area-${index}`}
                className="flex items-center gap-2"
              >
                <Field className="min-w-0 flex-1">
                  <FieldLabel
                    htmlFor={`${id}-area-${index}`}
                    className="sr-only"
                  >
                    Area {index + 1}
                  </FieldLabel>
                  <Input
                    id={`${id}-area-${index}`}
                    value={area}
                    placeholder="e.g. SE1 or 90210"
                    onChange={(event) =>
                      onChange({
                        ...bounds,
                        areas: bounds.areas.map((item, position) =>
                          position === index ? event.target.value : item,
                        ),
                      })
                    }
                  />
                </Field>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove area ${index + 1}`}
                  onClick={() =>
                    onChange({
                      ...bounds,
                      areas: bounds.areas.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                >
                  <LuTrash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              variant="link"
              size="inline"
              className="w-fit"
              onClick={() =>
                onChange({ ...bounds, areas: [...bounds.areas, ''] })
              }
            >
              + Add an area
            </Button>
          </div>
        ) : null}

        {bounds.mode === 'file' ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({ ...bounds, fileName: 'east-side-wards.geojson' })
              }
            >
              <LuUpload className="size-4" aria-hidden />
              {bounds.fileName ? 'Replace file' : 'Upload coordinates'}
            </Button>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {bounds.fileName ?? 'GeoJSON or a CSV of latitude and longitude.'}
            </span>
          </div>
        ) : null}
      </SettingsBlock>
    </div>
  );
}

/**
 * How far a rating runs and what its ends mean. A bare "3 out of 5" is not a
 * judgement until someone writes down what 1 and 5 are, so the end labels sit
 * next to the range rather than in a description nobody fills in.
 */
export function RatingSettings({
  rating,
  onChange,
}: {
  rating: RatingScale;
  onChange: (next: RatingScale) => void;
}) {
  const id = useId();

  return (
    <SettingsBlock legend="Scale">
      <RadioGroup
        value={String(rating.max)}
        onValueChange={(next) => {
          const match = RATING_MAXIMUMS.find(
            (option) => String(option) === next,
          );

          if (match) {
            onChange({ ...rating, max: match });
          }
        }}
        className="flex flex-row flex-wrap gap-2"
      >
        {RATING_MAXIMUMS.map((option) => (
          <FieldLabel
            key={option}
            htmlFor={`${id}-max-${option}`}
            variant="box"
            className="w-fit bg-background px-3 py-1.5"
          >
            <Field orientation="horizontal">
              <RadioGroupItem
                id={`${id}-max-${option}`}
                value={String(option)}
              />
              <span className="text-base">1&ndash;{option}</span>
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>

      <div className="grid grid-cols-2 items-start gap-3">
        <Field>
          <FieldLabel htmlFor={`${id}-low`}>1 means</FieldLabel>
          <Input
            id={`${id}-low`}
            value={rating.lowLabel ?? ''}
            maxLength={NAME_LIMIT}
            placeholder="e.g. Not feasible"
            onChange={(event) =>
              onChange({ ...rating, lowLabel: event.target.value })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-high`}>{rating.max} means</FieldLabel>
          <Input
            id={`${id}-high`}
            value={rating.highLabel ?? ''}
            maxLength={NAME_LIMIT}
            placeholder="e.g. Ready to build"
            onChange={(event) =>
              onChange({ ...rating, highLabel: event.target.value })
            }
          />
        </Field>
      </div>
    </SettingsBlock>
  );
}

/** One titled group of type settings, framed so it reads as a nested decision. */
function SettingsBlock({
  legend,
  children,
}: {
  legend: string;
  children: ReactNode;
}) {
  return (
    // No box and no small caps: inside an already-bordered card, a second
    // border around the answers was a frame inside a frame, and the caps were
    // a third voice. A field label over its rows is what this is.
    <fieldset className="flex flex-col gap-3">
      {/* Its own margin, not the fieldset's gap: a rendered `legend` sits
          outside the flex flow, so the gap that spaces everything else here
          skips straight past it. */}
      <legend className="mb-3 text-base leading-6 font-strong">{legend}</legend>
      {children}
    </fieldset>
  );
}

/**
 * The list of editors. A long form was a wall of open editors; collapsed, the
 * list reads as the form people will actually see. One open at a time, because
 * two half-written questions side by side is not a state worth supporting.
 *
 * The order is the order people will answer in, so the rows drag: the list owns
 * the mapping rather than taking rendered children, because reordering is a fact
 * about the list and not about any one row.
 */
export function PhaseFieldList<T extends { id: string }>({
  items,
  onReorder,
  open,
  onOpenChange,
  getItemLabel,
  children,
  pinned,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  /** The one open item, or none. */
  open: string[];
  onOpenChange: (next: string[]) => void;
  /** What the row is called while it is being dragged and announced. */
  getItemLabel?: (item: T) => string;
  children: (item: T, controls: SortableItemControls) => ReactNode;
  /**
   * Rows rendered after the draggable ones and left out of the drag entirely: a
   * row whose place is fixed can't be part of what reorders, and keeping it out
   * of the Sortable is what makes that true rather than merely displayed.
   */
  pinned?: ReactNode;
}) {
  return (
    <Accordion
      multiple={false}
      value={open}
      onValueChange={(next) => onOpenChange(next.map(String))}
      // The frame stacks these at the card's own 24, level with the gap from
      // the card's heading — each row is a thing, not a line of a list.
      className="gap-6"
    >
      <Sortable
        items={items}
        onChange={onReorder}
        dragTrigger="handle"
        getItemLabel={getItemLabel}
        className="flex flex-col gap-6"
      >
        {children}
      </Sortable>
      {pinned}
    </Accordion>
  );
}

/** One collapsed row: what the question says, and what kind of answer it takes. */
export function PhaseFieldListItem({
  id,
  title,
  fallback,
  isRequired,
  isConfidential,
  isLocked,
  dragHandleProps,
  children,
}: {
  id: string;
  title: string;
  /** Shown while the question has no wording yet. */
  fallback: string;
  /** Marked on the title, the way the form itself will mark it. */
  isRequired?: boolean;
  /** Badged on the row, so it is legible without opening the editor. */
  isConfidential?: boolean;
  /** Fixed in place: a lock where the grip would be, because it can't move. */
  isLocked?: boolean;
  /** From the list's Sortable. Absent on a pinned row, which has no handle. */
  dragHandleProps?: SortableItemControls['dragHandleProps'];
  children: ReactNode;
}) {
  return (
    <AccordionItem
      value={id}
      /* A box, not a rule: each question is a card of its own inside the form
         card. Open, it takes the page's own ground — it stops reading as part of
         the white form card and starts reading as the thing being edited. */
      className="rounded-lg border has-data-panel-open:bg-muted"
    >
      {/* A grid, not a flex row: the handle is a real button and so can't live
          inside the trigger, and the accordion's own header sizes to its content
          — the 1fr column is what still gives the trigger the rest of the row. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 ps-4">
        {/* The grip's slot, taken by a lock when the row is pinned: the handle
            is where you look to move something, so that is where its absence
            has to be said. */}
        {isLocked ? (
          <span className="flex items-center self-center text-muted-foreground">
            <LuLock className="size-4 shrink-0" aria-hidden />
            <span className="sr-only">Fixed in place.</span>
          </span>
        ) : (
          <DragHandle
            {...dragHandleProps}
            aria-label={`Reorder ${title || fallback}`}
            className="size-6 self-center p-0 text-muted-foreground"
          />
        )}

        <AccordionTrigger className="items-center gap-3 rounded-lg py-4 pe-4 hover:no-underline">
          {/* The question, and nothing else: what kind of answer it takes is the
            `Type` field's job once the card is open, and a second line here
            made every row of the form twice as tall for a word. `text-label`
            is the row's own style in the frame — the serif step the trigger
            already sets its family for, one size down from a card title. */}
          {/* `wrap-anywhere`, not `truncate`, and it is what makes the row hold
              its shape at all. The accordion wraps this trigger in an `h3` that
              is a grid item with the default `min-width: auto`, so the track's
              `minmax(0,1fr)` never gets to shrink it: a long unbroken name set
              the row's minimum width and ran straight out through the side of
              the card, past the border, with no ellipsis. `overflow-wrap:
              anywhere` is the one wrapping mode that also lowers the min-content
              contribution, so the chain can shrink and the name wraps instead —
              which is the behaviour wanted here anyway. `break-words` would not
              have done it; it wraps without changing min-content. */}
          <span
            className={cn(
              'me-2 min-w-0 flex-1 text-start text-label wrap-anywhere',
              !title && 'text-muted-foreground',
            )}
          >
            {title || fallback}
            {/* Where the form will put it, on the wording people will read. */}
            {isRequired ? <RequiredAsterisk /> : null}
          </span>

          {/* Confidential is the one setting with a consequence for the person
            answering, so it is stated on the row rather than only inside. A
            `span` trigger, not a button: this sits inside the accordion's own
            trigger, and a button in a button is neither valid nor operable —
            hover explains it, and the text below carries the same sentence to
            anything that can't hover. */}
          {isConfidential ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="me-2 flex shrink-0 items-center text-muted-foreground" />
                }
              >
                <LuEyeOff className="size-4" aria-hidden />
                <span className="sr-only">
                  Confidential. {CONFIDENTIAL_HINT}
                </span>
              </TooltipTrigger>
              <TooltipContent>{CONFIDENTIAL_HINT}</TooltipContent>
            </Tooltip>
          ) : null}
        </AccordionTrigger>
      </div>
      {/* Indented to the trigger's own text — 16 of padding, past the 24px grip
          and its 12px gap — so the editor starts where the question's name is
          rather than where its row does. */}
      <AccordionContent className="ps-13 pe-10 pt-3">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

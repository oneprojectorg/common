'use client';

import type { SurveyInternalData } from '@op/api';
import { trpc } from '@op/api/client';
import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@op/sense/Field';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Textarea } from '@op/sense/Textarea';
import { toast } from '@op/sense/Toast';
import { screens } from '@op/styles/constants';
import { useLocale } from 'next-intl';
import { useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

const OTHER_OPTION_ID = 'other';

const PROMOTER_OPTION_IDS = [
  'features',
  'intuitive',
  'fair',
  'data',
  'better-decisions',
  'no-tech-issues',
  'values',
  'support',
  'designed-for-us',
] as const;

const DETRACTOR_OPTION_IDS = [
  'missing-features',
  'complicated',
  'not-fair',
  'data-concerns',
  'doesnt-fit',
  'tech-issues',
  'alternatives',
  'no-help',
  'different-org',
] as const;

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j]!;
    copy[j] = tmp!;
  }
  return copy;
}

const NPS_SCORES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const SKIP_COOKIE_PREFIX = 'survey-skipped-';
const SKIP_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const getSurveySkipCookieName = (instanceId: string) =>
  `${SKIP_COOKIE_PREFIX}${instanceId}`;

export const hasSurveySkipCookie = (instanceId: string): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }
  const name = `${getSurveySkipCookieName(instanceId)}=`;
  return document.cookie.split('; ').some((c) => c.startsWith(name));
};

export const setSurveySkipCookie = (instanceId: string) => {
  document.cookie = `${getSurveySkipCookieName(instanceId)}=1; path=/; max-age=${SKIP_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
};

export const ProcessSurveyModal = ({
  instanceId,
  isOpen,
  onSkip,
}: {
  instanceId: string;
  isOpen: boolean;
  onSkip: () => void;
}) => {
  const t = useTranslations();
  const locale = useLocale();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;

  const [wasAdmin, setWasAdmin] = useState<string | null>(null);
  const [npsScore, setNpsScore] = useState<string | null>(null);
  const [promoterReasons, setPromoterReasons] = useState<string[]>([]);
  const [promoterReasonsOther, setPromoterReasonsOther] = useState('');
  const [detractorReasons, setDetractorReasons] = useState<string[]>([]);
  const [detractorReasonsOther, setDetractorReasonsOther] = useState('');
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const promoterLabels: Record<string, string> = {
    features: t('It has the specific features my organization needs'),
    intuitive: t("It's intuitive and easy to use"),
    fair: t('The decision-making processes feel fair and transparent'),
    data: t('It handles our data responsibly'),
    'better-decisions': t(
      'It helps us make better decisions than we would otherwise',
    ),
    'no-tech-issues': t('I had no technical issues'),
    values: t("It aligns with our community's values"),
    support: t('The support and documentation are helpful'),
    'designed-for-us': t("It's designed for organizations like ours"),
  };

  const detractorLabels: Record<string, string> = {
    'missing-features': t("It's missing critical features I need"),
    complicated: t("It's too complicated or hard to figure out"),
    'not-fair': t(
      "The decision-making process didn't feel fair or transparent",
    ),
    'data-concerns': t("I'm concerned about data privacy or security"),
    'doesnt-fit': t(
      "It doesn't fit how my organization actually makes decisions",
    ),
    'tech-issues': t(
      'I had technical issues (bugs, slow performance, mobile problems)',
    ),
    alternatives: t('There are better alternatives that do what I need'),
    'no-help': t('I could not find help when I had issues'),
    'different-org': t(
      "It feels like it's built for a different type of organization than mine",
    ),
  };

  const promoterOrder = useMemo(() => shuffle(PROMOTER_OPTION_IDS), []);
  const detractorOrder = useMemo(() => shuffle(DETRACTOR_OPTION_IDS), []);

  const npsNum = npsScore != null ? Number(npsScore) : null;
  const isPromoterCohort = npsNum != null && npsNum >= 7;
  const isDetractorCohort = npsNum != null && npsNum <= 6;

  const utils = trpc.useUtils();
  const submitSurvey = trpc.decision.submitProcessSurveyResponse.useMutation({
    onSuccess: (result) => {
      utils.decision.getProcessSurveyResponse.setData(
        { processInstanceId: instanceId },
        result,
      );
    },
    onError: (err) => {
      toast.error(err.message || t('Failed to submit survey'));
    },
  });

  const validate = (): boolean => {
    const next: Record<string, string | undefined> = {};

    if (wasAdmin == null) {
      next.wasAdmin = t('Please select an option');
    }
    if (npsScore == null) {
      next.npsScore = t('Please select a rating');
    }
    if (isPromoterCohort && promoterReasons.length === 0) {
      next.promoterReasons = t('Please select at least one option');
    }
    if (
      isPromoterCohort &&
      promoterReasons.includes(OTHER_OPTION_ID) &&
      !promoterReasonsOther.trim()
    ) {
      next.promoterReasonsOther = t('Please describe your answer');
    }
    if (isDetractorCohort && detractorReasons.length === 0) {
      next.detractorReasons = t('Please select at least one option');
    }
    if (
      isDetractorCohort &&
      detractorReasons.includes(OTHER_OPTION_ID) &&
      !detractorReasonsOther.trim()
    ) {
      next.detractorReasonsOther = t('Please describe your answer');
    }

    setErrors(next);
    return Object.values(next).every((v) => !v);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    const internalData: SurveyInternalData = {
      wasAdmin: wasAdmin === 'yes',
      npsScore: Number(npsScore),
      completedAt: new Date().toISOString(),
    };

    if (isPromoterCohort) {
      internalData.promoterReasons = promoterReasons;
      if (promoterReasons.includes(OTHER_OPTION_ID)) {
        internalData.promoterReasonsOther = promoterReasonsOther.trim();
      }
    }
    if (isDetractorCohort) {
      internalData.detractorReasons = detractorReasons;
      if (detractorReasons.includes(OTHER_OPTION_ID)) {
        internalData.detractorReasonsOther = detractorReasonsOther.trim();
      }
    }
    if (additionalFeedback.trim()) {
      internalData.additionalFeedback = additionalFeedback.trim();
    }
    if (additionalComments.trim()) {
      internalData.additionalComments = additionalComments.trim();
    }

    submitSurvey.mutate({
      processInstanceId: instanceId,
      internalData,
      locale,
    });
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-120"
      >
        <DialogHeader>
          <DialogTitle>{t('Your voice shapes Common.')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
            <p className="text-base text-foreground">
              {t(
                'Take our 1-minute survey. Your responses are always anonymous.',
              )}
            </p>

            <FieldSet>
              <FieldLegend variant="label">
                {t('Were you an admin during this process?')}{' '}
                <RequiredAsterisk />
              </FieldLegend>
              <RadioGroup
                value={wasAdmin}
                onValueChange={(value) => {
                  setWasAdmin(value == null ? null : String(value));
                  setErrors((prev) => ({ ...prev, wasAdmin: undefined }));
                }}
                aria-invalid={!!errors.wasAdmin}
                className="flex flex-row gap-4"
              >
                <Field orientation="horizontal">
                  <RadioGroupItem id="was-admin-yes" value="yes" />
                  <FieldLabel htmlFor="was-admin-yes">{t('Yes')}</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem id="was-admin-no" value="no" />
                  <FieldLabel htmlFor="was-admin-no">{t('No')}</FieldLabel>
                </Field>
              </RadioGroup>
              {errors.wasAdmin ? (
                <FieldError>{errors.wasAdmin}</FieldError>
              ) : null}
            </FieldSet>

            {isMobile ? (
              <Field data-invalid={!!errors.npsScore}>
                <FieldLabel htmlFor="nps-select">
                  {t(
                    'On a scale of 0 to 10, how likely are you to recommend Common to other organisations for participatory decisions?',
                  )}{' '}
                  <RequiredAsterisk />
                </FieldLabel>
                <Select
                  required
                  value={npsScore}
                  onValueChange={(value) => {
                    setNpsScore(value == null ? null : String(value));
                    setErrors((prev) => ({ ...prev, npsScore: undefined }));
                  }}
                >
                  <SelectTrigger
                    id="nps-select"
                    className="w-full"
                    aria-invalid={!!errors.npsScore}
                  >
                    <SelectValue placeholder={t('Select a rating')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {NPS_SCORES.map((score) => (
                        <SelectItem key={score} value={score}>
                          {score}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {t('0 ("Not at all likely") to 10 ("Extremely likely")')}
                </FieldDescription>
                {errors.npsScore ? (
                  <FieldError>{errors.npsScore}</FieldError>
                ) : null}
              </Field>
            ) : (
              <FieldSet>
                <FieldLegend variant="label">
                  {t(
                    'On a scale of 0 to 10, how likely are you to recommend Common to other organisations for participatory decisions?',
                  )}{' '}
                  <RequiredAsterisk />
                </FieldLegend>
                <RadioGroup
                  value={npsScore}
                  onValueChange={(value) => {
                    setNpsScore(value == null ? null : String(value));
                    setErrors((prev) => ({ ...prev, npsScore: undefined }));
                  }}
                  aria-invalid={!!errors.npsScore}
                  className="flex w-full flex-row justify-between gap-1"
                >
                  {NPS_SCORES.map((score) => (
                    <Field key={score} className="items-center gap-1">
                      <RadioGroupItem
                        className="size-4!"
                        id={`nps-${score}`}
                        value={score}
                      />
                      <FieldLabel
                        htmlFor={`nps-${score}`}
                        className="justify-center"
                      >
                        {score}
                      </FieldLabel>
                    </Field>
                  ))}
                </RadioGroup>
                <FieldDescription>
                  {t('0 ("Not at all likely") to 10 ("Extremely likely")')}
                </FieldDescription>
                {errors.npsScore ? (
                  <FieldError>{errors.npsScore}</FieldError>
                ) : null}
              </FieldSet>
            )}

            {isPromoterCohort && (
              <FieldSet>
                <FieldLegend variant="label">
                  {t('What makes Common worth recommending?')}
                  <RequiredAsterisk />
                </FieldLegend>
                <FieldDescription>
                  {t('Select all that apply')}
                </FieldDescription>
                {promoterOrder.map((id) => (
                  <Field
                    key={id}
                    className="items-start"
                    orientation="horizontal"
                  >
                    <Checkbox
                      id={`promoter-${id}`}
                      checked={promoterReasons.includes(id)}
                      onCheckedChange={(checked) => {
                        setPromoterReasons((prev) =>
                          checked
                            ? [...prev, id]
                            : prev.filter((v) => v !== id),
                        );
                        setErrors((prev) => ({
                          ...prev,
                          promoterReasons: undefined,
                        }));
                      }}
                      className="mt-1"
                    />
                    <FieldLabel htmlFor={`promoter-${id}`}>
                      {promoterLabels[id]}
                    </FieldLabel>
                  </Field>
                ))}
                <Field orientation="horizontal">
                  <Checkbox
                    id="promoter-other"
                    checked={promoterReasons.includes(OTHER_OPTION_ID)}
                    onCheckedChange={(checked) => {
                      setPromoterReasons((prev) =>
                        checked
                          ? [...prev, OTHER_OPTION_ID]
                          : prev.filter((v) => v !== OTHER_OPTION_ID),
                      );
                      setErrors((prev) => ({
                        ...prev,
                        promoterReasons: undefined,
                      }));
                    }}
                  />
                  <FieldLabel htmlFor="promoter-other">{t('Other')}</FieldLabel>
                </Field>
                {promoterReasons.includes(OTHER_OPTION_ID) && (
                  <Textarea
                    aria-label={t('Other')}
                    rows={2}
                    placeholder={t('Tell us more')}
                    value={promoterReasonsOther}
                    onChange={(e) => {
                      setPromoterReasonsOther(e.target.value);
                      setErrors((prev) => ({
                        ...prev,
                        promoterReasonsOther: undefined,
                      }));
                    }}
                    aria-invalid={!!errors.promoterReasonsOther}
                  />
                )}
                {errors.promoterReasons ? (
                  <FieldError>{errors.promoterReasons}</FieldError>
                ) : null}
                {errors.promoterReasonsOther ? (
                  <FieldError>{errors.promoterReasonsOther}</FieldError>
                ) : null}
              </FieldSet>
            )}

            {isDetractorCohort && (
              <FieldSet>
                <FieldLegend>
                  {t('What prevents you from recommending Common?')}{' '}
                  <RequiredAsterisk />
                </FieldLegend>
                <FieldDescription>
                  {t('Select all that apply')}
                </FieldDescription>
                {detractorOrder.map((id) => (
                  <Field
                    key={id}
                    className="items-start"
                    orientation="horizontal"
                  >
                    <Checkbox
                      id={`detractor-${id}`}
                      checked={detractorReasons.includes(id)}
                      onCheckedChange={(checked) => {
                        setDetractorReasons((prev) =>
                          checked
                            ? [...prev, id]
                            : prev.filter((v) => v !== id),
                        );
                        setErrors((prev) => ({
                          ...prev,
                          detractorReasons: undefined,
                        }));
                      }}
                      className="mt-1"
                    />
                    <FieldLabel htmlFor={`detractor-${id}`}>
                      {detractorLabels[id]}
                    </FieldLabel>
                  </Field>
                ))}
                <Field orientation="horizontal">
                  <Checkbox
                    id="detractor-other"
                    checked={detractorReasons.includes(OTHER_OPTION_ID)}
                    onCheckedChange={(checked) => {
                      setDetractorReasons((prev) =>
                        checked
                          ? [...prev, OTHER_OPTION_ID]
                          : prev.filter((v) => v !== OTHER_OPTION_ID),
                      );
                      setErrors((prev) => ({
                        ...prev,
                        detractorReasons: undefined,
                      }));
                    }}
                  />
                  <FieldLabel htmlFor="detractor-other">
                    {t('Other')}
                  </FieldLabel>
                </Field>
                {detractorReasons.includes(OTHER_OPTION_ID) && (
                  <Textarea
                    aria-label={t('Other')}
                    rows={2}
                    placeholder={t('Tell us more')}
                    value={detractorReasonsOther}
                    onChange={(e) => {
                      setDetractorReasonsOther(e.target.value);
                      setErrors((prev) => ({
                        ...prev,
                        detractorReasonsOther: undefined,
                      }));
                    }}
                    aria-invalid={!!errors.detractorReasonsOther}
                  />
                )}
                {errors.detractorReasons ? (
                  <FieldError>{errors.detractorReasons}</FieldError>
                ) : null}
                {errors.detractorReasonsOther ? (
                  <FieldError>{errors.detractorReasonsOther}</FieldError>
                ) : null}
              </FieldSet>
            )}

            <Field>
              <FieldLabel htmlFor="additional-feedback">
                {t(
                  'Any specific features we should fix, improve or keep? Any features we should add? We actually read these!',
                )}
              </FieldLabel>
              <Textarea
                id="additional-feedback"
                rows={3}
                value={additionalFeedback}
                onChange={(e) => setAdditionalFeedback(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="additional-comments">
                {t("Anything else you'd like to share?")}
              </FieldLabel>
              <Textarea
                id="additional-comments"
                rows={3}
                value={additionalComments}
                onChange={(e) => setAdditionalComments(e.target.value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              disabled={submitSurvey.isPending}
              className="w-full sm:w-auto"
            >
              {t('Maybe later')}
            </Button>
            <Button
              type="submit"
              variant="default"
              className="w-full sm:w-auto"
              disabled={submitSurvey.isPending}
            >
              {submitSurvey.isPending
                ? t('Submitting...')
                : t('Submit & view results')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

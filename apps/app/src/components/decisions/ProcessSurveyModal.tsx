'use client';

import type { SurveyInternalData } from '@op/api';
import { trpc } from '@op/api/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { Checkbox, CheckboxGroup } from '@op/ui/Checkbox';
import { Form } from '@op/ui/Form';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
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
  'ai',
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
  'dislike-ai',
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

export const getSurveySkipCookieName = (instanceId: string) =>
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
    ai: t('The AI features are really helpful'),
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
    'dislike-ai': t("I don't like the AI features"),
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
      toast.error({
        message: err.message || t('Failed to submit survey'),
      });
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

    submitSurvey.mutate({
      processInstanceId: instanceId,
      internalData,
      locale,
    });
  };

  return (
    <Modal isOpen={isOpen} className="flex flex-col">
      <ModalHeader>{t('Your voice shapes Common.')}</ModalHeader>
      <Form
        onSubmit={handleSubmit}
        validationBehavior="aria"
        className="flex flex-1 flex-col gap-0"
      >
        <ModalBody className="flex-1 gap-6">
          <p className="text-base text-neutral-charcoal">
            {t(
              'Take our 1-minute survey. Your responses are always anonymous.',
            )}
          </p>

          <RadioGroup
            label={t('Were you an admin during this process?')}
            isRequired
            value={wasAdmin}
            onChange={(value) => {
              setWasAdmin(value);
              setErrors((prev) => ({ ...prev, wasAdmin: undefined }));
            }}
            errorMessage={errors.wasAdmin}
            isInvalid={!!errors.wasAdmin}
            orientation="horizontal"
          >
            <Radio value="yes">{t('Yes')}</Radio>
            <Radio value="no">{t('No')}</Radio>
          </RadioGroup>

          {isMobile ? (
            <Select
              label={t(
                'On a scale of 0 to 10, how likely are you to recommend Common to other organisations for participatory decisions?',
              )}
              isRequired
              selectedKey={npsScore}
              onSelectionChange={(key) => {
                setNpsScore(key == null ? null : String(key));
                setErrors((prev) => ({ ...prev, npsScore: undefined }));
              }}
              description={t(
                '0 ("Not at all likely") to 10 ("Extremely likely")',
              )}
              errorMessage={errors.npsScore}
              placeholder={t('Select a rating')}
            >
              {NPS_SCORES.map((score) => (
                <SelectItem key={score} id={score}>
                  {score}
                </SelectItem>
              ))}
            </Select>
          ) : (
            <RadioGroup
              label={t(
                'On a scale of 0 to 10, how likely are you to recommend Common to other organisations for participatory decisions?',
              )}
              isRequired
              value={npsScore}
              onChange={(value) => {
                setNpsScore(value);
                setErrors((prev) => ({ ...prev, npsScore: undefined }));
              }}
              description={t(
                '0 ("Not at all likely") to 10 ("Extremely likely")',
              )}
              errorMessage={errors.npsScore}
              isInvalid={!!errors.npsScore}
              orientation="horizontal"
              className="[&>div]:w-full [&>div]:justify-between [&>div]:gap-0"
            >
              {NPS_SCORES.map((score) => (
                <Radio
                  key={score}
                  value={score}
                  labelPosition="bottom"
                  className="flex-1"
                >
                  {score}
                </Radio>
              ))}
            </RadioGroup>
          )}

          {isPromoterCohort && (
            <CheckboxGroup
              label={t('What makes Common worth recommending?')}
              description={t('Select all that apply')}
              isRequired
              value={promoterReasons}
              onChange={(value) => {
                setPromoterReasons(value);
                setErrors((prev) => ({ ...prev, promoterReasons: undefined }));
              }}
              errorMessage={errors.promoterReasons}
              isInvalid={!!errors.promoterReasons}
            >
              {promoterOrder.map((id) => (
                <Checkbox key={id} value={id} size="small">
                  {promoterLabels[id]}
                </Checkbox>
              ))}
              <Checkbox value={OTHER_OPTION_ID} size="small">
                {t('Other')}
              </Checkbox>
              {promoterReasons.includes(OTHER_OPTION_ID) && (
                <TextField
                  aria-label={t('Other')}
                  useTextArea
                  value={promoterReasonsOther}
                  onChange={(value) => {
                    setPromoterReasonsOther(value);
                    setErrors((prev) => ({
                      ...prev,
                      promoterReasonsOther: undefined,
                    }));
                  }}
                  errorMessage={errors.promoterReasonsOther}
                  textareaProps={{ rows: 2, placeholder: t('Tell us more') }}
                />
              )}
            </CheckboxGroup>
          )}

          {isDetractorCohort && (
            <CheckboxGroup
              label={t('What prevents you from recommending Common?')}
              description={t('Select all that apply')}
              isRequired
              value={detractorReasons}
              onChange={(value) => {
                setDetractorReasons(value);
                setErrors((prev) => ({ ...prev, detractorReasons: undefined }));
              }}
              errorMessage={errors.detractorReasons}
              isInvalid={!!errors.detractorReasons}
            >
              {detractorOrder.map((id) => (
                <Checkbox key={id} value={id} size="small">
                  {detractorLabels[id]}
                </Checkbox>
              ))}
              <Checkbox value={OTHER_OPTION_ID} size="small">
                {t('Other')}
              </Checkbox>
              {detractorReasons.includes(OTHER_OPTION_ID) && (
                <TextField
                  aria-label={t('Other')}
                  useTextArea
                  value={detractorReasonsOther}
                  onChange={(value) => {
                    setDetractorReasonsOther(value);
                    setErrors((prev) => ({
                      ...prev,
                      detractorReasonsOther: undefined,
                    }));
                  }}
                  errorMessage={errors.detractorReasonsOther}
                  textareaProps={{ rows: 2, placeholder: t('Tell us more') }}
                />
              )}
            </CheckboxGroup>
          )}

          <TextField
            label={t(
              'Any specific features we should fix, improve or keep? Any features we should add? We actually read these!',
            )}
            useTextArea
            value={additionalFeedback}
            onChange={setAdditionalFeedback}
            textareaProps={{ rows: 3 }}
          />
        </ModalBody>
        <ModalFooter className="sticky">
          <Button
            type="button"
            variant="link"
            onPress={onSkip}
            isDisabled={submitSurvey.isPending}
            className="w-full sm:w-auto"
          >
            {t('Maybe later')}
          </Button>
          <Button
            type="submit"
            color="primary"
            className="w-full sm:w-auto"
            isDisabled={submitSurvey.isPending}
          >
            {submitSurvey.isPending
              ? t('Submitting...')
              : t('Submit & view results')}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

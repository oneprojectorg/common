'use client';

import { countries } from '@/utils/countries';
import { Button } from '@op/ui/Button';
import { Checkbox, CheckboxGroup } from '@op/ui/Checkbox';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { CurrentSurveyData } from './VoteSubmissionModal';

export const VoteSurveyStep = ({
  initialData,
  isSubmitting,
  onSubmit,
}: {
  initialData: CurrentSurveyData;
  isSubmitting: boolean;
  onSubmit: (data: CurrentSurveyData) => void;
}) => {
  const t = useTranslations();
  const [formData, setFormData] = useState<CurrentSurveyData>(initialData);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CurrentSurveyData, string>>
  >({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CurrentSurveyData, string>> = {};

    if (!formData.role || formData.role.length === 0) {
      newErrors.role = 'Please select at least one role';
    }
    if (formData.role && formData.role.length > 2) {
      newErrors.role = 'Please select up to two options';
    }
    if (!formData.region) {
      newErrors.region = 'Please select your region';
    }
    if (!formData.country.trim()) {
      newErrors.country = 'Please enter your country';
    }
    if (!formData.gender) {
      newErrors.gender = 'Please select your gender identity';
    }
    if (!formData.satisfactionPPDecides) {
      newErrors.satisfactionPPDecides = 'Please rate your satisfaction';
    }
    if (!formData.likedAboutPPDecides.trim()) {
      newErrors.likedAboutPPDecides = 'Please share what you liked';
    }
    if (!formData.improvementsPPDecides.trim()) {
      newErrors.improvementsPPDecides = 'Please share what could be improved';
    }
    if (!formData.satisfactionMembership) {
      newErrors.satisfactionMembership = 'Please rate your satisfaction';
    }
    if (!formData.increasedUnderstanding) {
      newErrors.increasedUnderstanding = 'Please select an option';
    }
    if (!formData.appliedNewPractices) {
      newErrors.appliedNewPractices = 'Please select an option';
    }
    if (!formData.likelyToRecommendCommon) {
      newErrors.likelyToRecommendCommon = 'Please rate how likely you are to recommend';
    }
    if (!formData.easeOfUse) {
      newErrors.easeOfUse = 'Please rate the ease of use';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-base text-neutral-charcoal">
        {t(
          'To submit your ballot, please fill out the following brief survey.',
        )}
      </p>

      <CheckboxGroup
        label={t('Which is your Role at People Powered?')}
        description={t('You can select up to two options.')}
        className="gap-3"
        value={formData.role}
        isRequired
        onChange={(value) => {
          setFormData((prev) => ({
            ...prev,
            role: value as CurrentSurveyData['role'],
          }));
          if (errors.role) {
            setErrors((prev) => ({ ...prev, role: undefined }));
          }
        }}
        errorMessage={errors.role}
        isInvalid={!!errors.role}
      >
        <Checkbox size="small" className="text-base" value="member_org">
          {t('Part of a Member Organization')}
        </Checkbox>
        <Checkbox size="small" className="text-base" value="individual">
          {t('Individual Member')}
        </Checkbox>
        <Checkbox size="small" className="text-base" value="board">
          {t('Board of Directors')}
        </Checkbox>
        <Checkbox size="small" className="text-base" value="staff">
          {t('Staff')}
        </Checkbox>
      </CheckboxGroup>

      <RadioGroup
        label={t('Which region of the world are you from?')}
        value={formData.region}
        onChange={(value) => {
          setFormData((prev) => ({ ...prev, region: value }));
          if (errors.region) {
            setErrors((prev) => ({ ...prev, region: undefined }));
          }
        }}
        isRequired
        errorMessage={errors.region}
        isInvalid={!!errors.region}
        orientation="vertical"
      >
        <span className="flex flex-col gap-3">
          <Radio value="africa" className="p-0">
            {t('Africa')}
          </Radio>
          <Radio value="asia" className="p-0">
            {t('Asia')}
          </Radio>
          <Radio value="eastern_europe" className="p-0">
            {t('Eastern Europe')}
          </Radio>
          <Radio value="western_northern_europe" className="p-0">
            {t('Western & Northern Europe')}
          </Radio>
          <Radio value="latin_america" className="p-0">
            {t('Latin America')}
          </Radio>
          <Radio value="us_canada" className="p-0">
            {t('US & Canada')}
          </Radio>
          <Radio value="oceania" className="p-0">
            {t('Oceania')}
          </Radio>
        </span>
      </RadioGroup>

      <Select
        label={t('Which country are you from?')}
        size="medium"
        onSelectionChange={(value) => {
          setFormData((prev) => ({ ...prev, country: value.toString() }));
          if (errors.country) {
            setErrors((prev) => ({ ...prev, country: undefined }));
          }
        }}
        placeholder={t('Enter your country')}
        isRequired
        icon={<LuSearch className="size-4 text-neutral-gray4" />}
      >
        {Object.entries(countries).map(([code, name]) => (
          <SelectItem key={code} id={code}>
            {name}
          </SelectItem>
        ))}
      </Select>

      <RadioGroup
        label={t('You identify as:')}
        value={formData.gender}
        onChange={(value) => {
          setFormData((prev) => ({ ...prev, gender: value }));
          if (errors.gender) {
            setErrors((prev) => ({ ...prev, gender: undefined }));
          }
        }}
        isRequired
        errorMessage={errors.gender}
        isInvalid={!!errors.gender}
        orientation="vertical"
      >
        <span className="flex flex-col gap-3">
          <Radio value="female" className="p-0">
            {t('Female')}
          </Radio>
          <Radio value="male" className="p-0">
            {t('Male')}
          </Radio>
          <Radio value="non_binary" className="p-0">
            {t('Non-binary')}
          </Radio>
          <Radio value="other" className="p-0">
            {t('Other')}
          </Radio>
          <Radio value="prefer_not_to_say" className="p-0">
            {t('Prefer not to say')}
          </Radio>
        </span>
      </RadioGroup>

      <RadioGroup
        label={t(
          "On a scale of 1-5 (1 being 'not satisfied' and 5 being 'very satisfied'), how satisfied are you with PP Decides 2026?",
        )}
        value={formData.satisfactionPPDecides}
        onChange={(value) => {
          setFormData((prev) => ({ ...prev, satisfactionPPDecides: value }));
          if (errors.satisfactionPPDecides) {
            setErrors((prev) => ({
              ...prev,
              satisfactionPPDecides: undefined,
            }));
          }
        }}
        isRequired
        errorMessage={errors.satisfactionPPDecides}
        isInvalid={!!errors.satisfactionPPDecides}
        orientation="horizontal"
      >
        <Radio value="1" className="p-0" labelPosition="bottom">
          {t('1')}
        </Radio>
        <Radio value="2" className="p-0" labelPosition="bottom">
          {t('2')}
        </Radio>
        <Radio value="3" className="p-0" labelPosition="bottom">
          {t('3')}
        </Radio>
        <Radio value="4" className="p-0" labelPosition="bottom">
          {t('4')}
        </Radio>
        <Radio value="5" className="p-0" labelPosition="bottom">
          {t('5')}
        </Radio>
      </RadioGroup>

      <TextField
        label={t('What did you like about PP Decides?')}
        value={formData.likedAboutPPDecides}
        onChange={(value) => {
          setFormData((prev) => ({ ...prev, likedAboutPPDecides: value }));
          if (errors.likedAboutPPDecides) {
            setErrors((prev) => ({ ...prev, likedAboutPPDecides: undefined }));
          }
        }}
        isRequired
        errorMessage={errors.likedAboutPPDecides}
        useTextArea
        textareaProps={{ rows: 4 }}
      />

      <TextField
        label={t('What could be improved about PP Decides?')}
        description={t(
          'You can share feedback on different stages of the process: idea collection, proposal development, ballot development, and vote. You can also share feedback on aspects such as the Zoom meetings, communications, timeline, inclusion, and technology.',
        )}
        value={formData.improvementsPPDecides}
        onChange={(value) => {
          setFormData((prev) => ({
            ...prev,
            improvementsPPDecides: value,
          }));
          if (errors.improvementsPPDecides) {
            setErrors((prev) => ({
              ...prev,
              improvementsPPDecides: undefined,
            }));
          }
        }}
        isRequired
        errorMessage={errors.improvementsPPDecides}
        useTextArea
        textareaProps={{ rows: 4 }}
      />

      <RadioGroup
        label={t(
          "On a scale of 1-5 (1 being 'not satisfied' and 5 being 'very satisfied'), how satisfied are you with your membership experience at People Powered?",
        )}
        value={formData.satisfactionMembership}
        onChange={(value) => {
          setFormData((prev) => ({ ...prev, satisfactionMembership: value }));
          if (errors.satisfactionMembership) {
            setErrors((prev) => ({
              ...prev,
              satisfactionMembership: undefined,
            }));
          }
        }}
        isRequired
        errorMessage={errors.satisfactionMembership}
        isInvalid={!!errors.satisfactionMembership}
        orientation="horizontal"
      >
        <Radio value="1" className="p-0" labelPosition="bottom">
          {t('1')}
        </Radio>
        <Radio value="2" className="p-0" labelPosition="bottom">
          {t('2')}
        </Radio>
        <Radio value="3" className="p-0" labelPosition="bottom">
          {t('3')}
        </Radio>
        <Radio value="4" className="p-0" labelPosition="bottom">
          {t('4')}
        </Radio>
        <Radio value="5" className="p-0" labelPosition="bottom">
          {t('5')}
        </Radio>
        <Radio value="na" className="p-0" labelPosition="bottom">
          {t('N/A')}
        </Radio>
      </RadioGroup>

      <RadioGroup
        label={t(
          'Has membership in PP increased your understanding of how to include traditionally marginalized groups in participatory and deliberative democracy programs?',
        )}
        value={formData.increasedUnderstanding}
        onChange={(value) => {
          setFormData((prev) => ({ ...prev, increasedUnderstanding: value }));
          if (errors.increasedUnderstanding) {
            setErrors((prev) => ({
              ...prev,
              increasedUnderstanding: undefined,
            }));
          }
        }}
        isRequired
        errorMessage={errors.increasedUnderstanding}
        isInvalid={!!errors.increasedUnderstanding}
        orientation="vertical"
      >
        <span className="flex flex-col gap-3">
          <Radio value="yes" className="p-0">
            {t('Yes')}
          </Radio>
          <Radio value="no" className="p-0">
            {t('No')}
          </Radio>
          <Radio value="na" className="p-0">
            {t("N/A (I'm staff or board! Skipping this question)")}
          </Radio>
        </span>
      </RadioGroup>

      <RadioGroup
        label={t(
          'Have you applied new practices for inclusion of traditionally marginalized groups as a result of PP membership?',
        )}
        value={formData.appliedNewPractices}
        onChange={(value) => {
          setFormData((prev) => ({ ...prev, appliedNewPractices: value }));
          if (errors.appliedNewPractices) {
            setErrors((prev) => ({
              ...prev,
              appliedNewPractices: undefined,
            }));
          }
        }}
        isRequired
        errorMessage={errors.appliedNewPractices}
        isInvalid={!!errors.appliedNewPractices}
        orientation="vertical"
      >
        <span className="flex flex-col gap-3">
          <Radio value="yes" className="p-0">
            {t('Yes')}
          </Radio>
          <Radio value="no" className="p-0">
            {t('No')}
          </Radio>
          <Radio value="na" className="p-0">
            {t("N/A (I'm staff or board! Skipping this question)")}
          </Radio>
        </span>
      </RadioGroup>

      <RadioGroup
        label={t(
          'On a scale of 1 to 5, how likely are you to recommend this platform, Common, to other organisations for participatory decision-making processes?',
        )}
        value={formData.likelyToRecommendCommon}
        onChange={(value) => {
          setFormData((prev) => ({
            ...prev,
            likelyToRecommendCommon: value,
          }));
          if (errors.likelyToRecommendCommon) {
            setErrors((prev) => ({
              ...prev,
              likelyToRecommendCommon: undefined,
            }));
          }
        }}
        isRequired
        errorMessage={errors.likelyToRecommendCommon}
        isInvalid={!!errors.likelyToRecommendCommon}
        orientation="horizontal"
      >
        <Radio value="1" className="p-0" labelPosition="bottom">
          {t('1')}
        </Radio>
        <Radio value="2" className="p-0" labelPosition="bottom">
          {t('2')}
        </Radio>
        <Radio value="3" className="p-0" labelPosition="bottom">
          {t('3')}
        </Radio>
        <Radio value="4" className="p-0" labelPosition="bottom">
          {t('4')}
        </Radio>
        <Radio value="5" className="p-0" labelPosition="bottom">
          {t('5')}
        </Radio>
      </RadioGroup>

      <RadioGroup
        label={t(
          'How easy was it to review proposals and cast your vote? (1 to 5 scale)',
        )}
        value={formData.easeOfUse}
        onChange={(value) => {
          setFormData((prev) => ({ ...prev, easeOfUse: value }));
          if (errors.easeOfUse) {
            setErrors((prev) => ({ ...prev, easeOfUse: undefined }));
          }
        }}
        isRequired
        errorMessage={errors.easeOfUse}
        isInvalid={!!errors.easeOfUse}
        orientation="horizontal"
      >
        <Radio value="1" className="p-0" labelPosition="bottom">
          {t('1')}
        </Radio>
        <Radio value="2" className="p-0" labelPosition="bottom">
          {t('2')}
        </Radio>
        <Radio value="3" className="p-0" labelPosition="bottom">
          {t('3')}
        </Radio>
        <Radio value="4" className="p-0" labelPosition="bottom">
          {t('4')}
        </Radio>
        <Radio value="5" className="p-0" labelPosition="bottom">
          {t('5')}
        </Radio>
      </RadioGroup>

      <div className="flex justify-end">
        <Button
          onPress={handleSubmit}
          isDisabled={isSubmitting}
          variant="primary"
          className="w-full"
        >
          {isSubmitting ? t('Submitting...') : t('Submit my votes')}
        </Button>
      </div>
    </div>
  );
};

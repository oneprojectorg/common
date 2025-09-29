'use client';

import { Button } from '@op/ui/Button';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { TextField } from '@op/ui/TextField';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { SurveyData } from './VoteSubmissionModal';

interface VoteSurveyStepProps {
  initialData: SurveyData;
  isSubmitting: boolean;
  onSubmit: (data: SurveyData) => void;
}

export const VoteSurveyStep = ({
  initialData,
  isSubmitting,
  onSubmit,
}: VoteSurveyStepProps) => {
  const t = useTranslations();
  const [formData, setFormData] = useState<SurveyData>(initialData);
  const [errors, setErrors] = useState<Partial<SurveyData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<SurveyData> = {};

    if (!formData.role) {
      newErrors.role = 'Please select your role' as any;
    }
    if (!formData.region) {
      newErrors.region = 'Please select your region' as any;
    }
    if (!formData.country.trim()) {
      newErrors.country = 'Please enter your country';
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

      <RadioGroup
        label={t('Which is your Role at People Powered?')}
        description={t('You can select up to two options.')}
        className="gap-3"
        value={formData.role}
        isRequired
        onChange={(value) => {
          setFormData((prev) => ({
            ...prev,
            role: value as SurveyData['role'],
          }));
          if (errors.role) {
            setErrors((prev) => ({ ...prev, role: undefined }));
          }
        }}
        errorMessage={errors.role as string}
        isInvalid={!!errors.role}
        orientation="vertical"
      >
        <Radio value="member_org">Part of a Member Organization</Radio>
        <Radio value="individual">Individual Member</Radio>
        <Radio value="board">Board of Directors</Radio>
        <Radio value="staff">Staff</Radio>
      </RadioGroup>

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
        errorMessage={errors.region as string}
        isInvalid={!!errors.region}
        orientation="vertical"
      >
        <span className="flex flex-col gap-1">
          <Radio value="africa">Africa</Radio>
          <Radio value="asia">Asia</Radio>
          <Radio value="eastern_europe">Eastern Europe</Radio>
          <Radio value="western_northern_europe">
            Western & Northern Europe
          </Radio>
          <Radio value="latin_america">Latin America</Radio>
          <Radio value="us_canada">US & Canada</Radio>
          <Radio value="oceania">Oceania</Radio>
        </span>
      </RadioGroup>

      <TextField
        label={t('Which country are you from?')}
        value={formData.country}
        isRequired
        onChange={(value) => {
          setFormData((prev) => ({ ...prev, country: value }));
          if (errors.country) {
            setErrors((prev) => ({ ...prev, country: undefined }));
          }
        }}
        errorMessage={errors.country}
        isInvalid={!!errors.country}
      />

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

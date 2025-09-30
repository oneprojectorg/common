'use client';

import { countries } from '@/utils/countries';
import { Button } from '@op/ui/Button';
import { Checkbox, CheckboxGroup } from '@op/ui/Checkbox';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { Select, SelectItem } from '@op/ui/Select';
import { useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { SurveyData } from './VoteSubmissionModal';

export const VoteSurveyStep = ({
  initialData,
  isSubmitting,
  onSubmit,
}: {
  initialData: SurveyData;
  isSubmitting: boolean;
  onSubmit: (data: SurveyData) => void;
}) => {
  const t = useTranslations();
  const [formData, setFormData] = useState<SurveyData>(initialData);
  const [errors, setErrors] = useState<
    Partial<Record<keyof SurveyData, string>>
  >({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SurveyData, string>> = {};

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
            role: value as SurveyData['role'],
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

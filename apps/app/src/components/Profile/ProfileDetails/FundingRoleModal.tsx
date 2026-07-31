import { Button } from '@op/sense/Button';
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@op/sense/Field';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { useState, useTransition } from 'react';

import { useTranslations } from '@/lib/i18n';

export type FundingRole = 'funder' | 'fundee' | 'funderAndFundee';

interface FundingRoleModalProps {
  organizationName: string;
  onSave: (role: FundingRole) => Promise<void>;
  onCancel: () => void;
}

export const FundingRoleModal = ({
  organizationName,
  onSave,
  onCancel,
}: FundingRoleModalProps) => {
  const t = useTranslations();
  const [selectedRole, setSelectedRole] = useState<FundingRole | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const handleSave = () => {
    if (!selectedRole) return;

    startTransition(async () => {
      await onSave(selectedRole);
    });
  };

  return (
    <DialogContent className="sm:min-w-[29rem]">
      <DialogHeader>
        <DialogTitle>{t('Specify your funding relationship')}</DialogTitle>
      </DialogHeader>
      <div className="px-6 py-4">
        <FieldSet>
          <FieldLegend>
            {t('How do your organizations support each other?')}
          </FieldLegend>
          <RadioGroup
            value={selectedRole ?? ''}
            onValueChange={(value) => setSelectedRole(value as FundingRole)}
          >
            <Field>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="funder" value="funder" />
                <FieldLabel htmlFor="funder">
                  {t('Your organization funds {organizationName}', {
                    organizationName,
                  })}
                </FieldLabel>
              </div>
              <FieldDescription className="ps-6">
                {t(
                  'Your organization provides financial support to {organizationName}.',
                  { organizationName },
                )}
              </FieldDescription>
            </Field>
            <Field>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="fundee" value="fundee" />
                <FieldLabel htmlFor="fundee">
                  {t('{organizationName} funds your organization', {
                    organizationName,
                  })}
                </FieldLabel>
              </div>
              <FieldDescription className="ps-6">
                {t(
                  '{organizationName} provides financial support to your organization.',
                  { organizationName },
                )}
              </FieldDescription>
            </Field>
            <Field>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="funderAndFundee" value="funderAndFundee" />
                <FieldLabel htmlFor="funderAndFundee">
                  {t('Mutual funding')}
                </FieldLabel>
              </div>
              <FieldDescription className="ps-6">
                {t(
                  'Both organizations provide financial support to each other.',
                )}
              </FieldDescription>
            </Field>
          </RadioGroup>
        </FieldSet>
      </div>
      <DialogFooter>
        <Button
          onClick={onCancel}
          variant="outline"
          type="button"
          className="w-full sm:w-fit"
        >
          {t('Cancel')}
        </Button>
        <Button
          variant="default"
          type="button"
          loading={isSubmitting}
          disabled={!selectedRole}
          onClick={handleSave}
          className="w-full sm:w-fit"
        >
          {t('Save')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

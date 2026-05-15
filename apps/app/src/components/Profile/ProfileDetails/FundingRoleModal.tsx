import { Button } from '@op/ui-next/Button';
import { Field, FieldLabel } from '@op/ui-next/Field';
import { LoadingSpinner } from '@op/ui-next/LoadingSpinner';
import { RadioGroup, RadioGroupItem } from '@op/ui-next/RadioGroup';
import { ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Dialog } from '@op/ui/RAC';
import { useState, useTransition } from 'react';

import { useTranslations } from '@/lib/i18n';

export type FundingRole = 'funder' | 'fundee' | 'funderAndFundee';

interface FundingRoleModalProps {
  organizationName: string;
  onSave: (role: FundingRole) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

export const FundingRoleModal = ({
  organizationName,
  onSave,
  isOpen,
  onClose,
}: FundingRoleModalProps) => {
  const t = useTranslations();
  const [selectedRole, setSelectedRole] = useState<FundingRole | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const handleSave = () => {
    if (!selectedRole) return;

    startTransition(async () => {
      await onSave(selectedRole);
      onClose();
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog>
      {({ close }) => (
        <div>
          <ModalHeader>{t('Specify your funding relationship')}</ModalHeader>
          <ModalBody>
            <div>
              <Field>
                <FieldLabel>
                  {t('How do your organizations support each other?')}
                </FieldLabel>
                <RadioGroup
                  value={selectedRole || ''}
                  onValueChange={(value: string) =>
                    setSelectedRole(value as FundingRole)
                  }
                  className="flex flex-col gap-2"
                >
                  <label
                    htmlFor="funding-funder"
                    className="flex items-start gap-2 py-2"
                  >
                    <RadioGroupItem
                      id="funding-funder"
                      value="funder"
                      className="mt-1"
                    />
                    <div className="flex flex-col">
                      <div>
                        {t('Your organization funds {organizationName}', {
                          organizationName,
                        })}
                      </div>
                      <div className="text-sm text-neutral-gray4">
                        {t(
                          'Your organization provides financial support to {organizationName}.',
                          { organizationName },
                        )}
                      </div>
                    </div>
                  </label>
                  <label
                    htmlFor="funding-fundee"
                    className="flex items-start gap-2 py-2"
                  >
                    <RadioGroupItem
                      id="funding-fundee"
                      value="fundee"
                      className="mt-1"
                    />
                    <div className="flex flex-col">
                      <div>
                        {t('{organizationName} funds your organization', {
                          organizationName,
                        })}
                      </div>
                      <div className="text-sm text-neutral-gray4">
                        {t(
                          '{organizationName} provides financial support to your organization.',
                          { organizationName },
                        )}
                      </div>
                    </div>
                  </label>
                  <label
                    htmlFor="funding-both"
                    className="flex items-start gap-2 py-2"
                  >
                    <RadioGroupItem
                      id="funding-both"
                      value="funderAndFundee"
                      className="mt-1"
                    />
                    <div className="flex flex-col">
                      <div>{t('Mutual funding')}</div>
                      <div className="text-sm text-neutral-gray4">
                        {t(
                          'Both organizations provide financial support to each other.',
                        )}
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </Field>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              onPress={() => {
                onClose();
                close();
              }}
              color="secondary"
              type="button"
              className="w-full sm:w-fit"
            >
              {t('Cancel')}
            </Button>
            <Button
              color="primary"
              type="button"
              isPending={isSubmitting}
              isDisabled={!selectedRole}
              onPress={handleSave}
              className="w-full sm:w-fit"
            >
              {isSubmitting ? <LoadingSpinner /> : t('Save')}
            </Button>
          </ModalFooter>
        </div>
      )}
    </Dialog>
  );
};

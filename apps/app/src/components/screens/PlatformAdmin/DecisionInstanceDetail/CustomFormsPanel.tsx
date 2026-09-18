'use client';

import { trpc } from '@op/api/client';
import type {
  AdminDecisionPhase,
  CustomFormWithPhaseDTO,
} from '@op/common/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@op/sense/AlertDialog';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@op/sense/Card';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Toast';
import { Suspense, useState } from 'react';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CustomFormBuilderDialog } from './CustomFormBuilderDialog';
import { countFields, resolvePhaseBadge } from './formDefinition';

interface CustomFormsPanelProps {
  /** Null on instances that never got one. */
  profileId: string | null;
  phases: AdminDecisionPhase[];
}

export const CustomFormsPanel = ({
  profileId,
  phases,
}: CustomFormsPanelProps) => {
  const t = useTranslations();

  if (!profileId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('Forms')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('This decision has no profile, so a form cannot attach to it.')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <CustomFormsPanelSuspense profileId={profileId} phases={phases} />
    </Suspense>
  );
};

const CustomFormsPanelSuspense = ({
  profileId,
  phases,
}: {
  profileId: string;
  phases: AdminDecisionPhase[];
}) => {
  const t = useTranslations();
  const [forms] = trpc.customForm.list.useSuspenseQuery({ profileId });
  const [editing, setEditing] = useState<CustomFormWithPhaseDTO | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const occupiedPhaseIds = forms
    .map((form) => form.phaseId)
    .filter((phaseId): phaseId is string => phaseId !== null);

  const canAdd = phases.some(
    (phase) => !occupiedPhaseIds.includes(phase.phaseId),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Forms')}</CardTitle>
        <CardDescription>
          {t('Extra questions participants answer during a phase')}
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            disabled={!canAdd}
            onClick={() => setIsCreating(true)}
          >
            <LuPlus data-icon="inline-start" />
            {t('New form')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {forms.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            {t('No forms yet.')}
          </p>
        ) : (
          forms.map((form) => (
            <CustomFormRow
              key={form.id}
              form={form}
              phases={phases}
              onEdit={() => setEditing(form)}
            />
          ))
        )}
        <PhaseAvailabilityNote hasPhases={phases.length > 0} canAdd={canAdd} />
      </CardContent>

      <CustomFormBuilderDialog
        isOpen={isCreating}
        onOpenChange={setIsCreating}
        profileId={profileId}
        phases={phases}
        occupiedPhaseIds={occupiedPhaseIds}
      />

      <CustomFormBuilderDialog
        isOpen={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
        profileId={profileId}
        phases={phases}
        // The form being edited keeps its own phase; only the others are taken.
        occupiedPhaseIds={occupiedPhaseIds.filter(
          (phaseId) => phaseId !== editing?.phaseId,
        )}
        form={editing ?? undefined}
      />
    </Card>
  );
};

const PhaseAvailabilityNote = ({
  hasPhases,
  canAdd,
}: {
  hasPhases: boolean;
  canAdd: boolean;
}) => {
  const t = useTranslations();

  if (canAdd) {
    return null;
  }

  return (
    <p className="text-sm text-muted-foreground">
      {hasPhases
        ? t('Every phase already has a form.')
        : t('This decision has no phases to attach a form to.')}
    </p>
  );
};

const CustomFormRow = ({
  form,
  phases,
  onEdit,
}: {
  form: CustomFormWithPhaseDTO;
  phases: AdminDecisionPhase[];
  onEdit: () => void;
}) => {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{form.name}</span>
        <span className="truncate text-sm text-muted-foreground">
          {t('{count, plural, one {# field} other {# fields}}', {
            count: countFields(form.schema),
          })}
        </span>
      </div>
      <FormPhaseBadge phaseId={form.phaseId} phases={phases} />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('Edit {name}', { name: form.name })}
          onClick={onEdit}
        >
          <LuPencil />
        </Button>
        <DeleteFormButton form={form} />
      </div>
    </div>
  );
};

const FormPhaseBadge = ({
  phaseId,
  phases,
}: {
  phaseId: string | null;
  phases: AdminDecisionPhase[];
}) => {
  const t = useTranslations();
  const { label, isKnownPhase } = resolvePhaseBadge({
    phaseId,
    phases,
    unsetLabel: t('No phase'),
  });

  return (
    <Badge variant={isKnownPhase ? 'secondary' : 'outline'}>{label}</Badge>
  );
};

const DeleteFormButton = ({ form }: { form: CustomFormWithPhaseDTO }) => {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  const deleteForm = trpc.customForm.delete.useMutation({
    onSuccess: () => {
      toast.success(t('Form deleted'));
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Through AlertDialogTrigger, not a bare Button: the trigger is what
          base-ui returns focus to when the dialog closes. */}
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('Delete {name}', { name: form.name })}
          />
        }
      >
        <LuTrash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('Delete {name}?', { name: form.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'Participants stop seeing this form. Answers already submitted are kept.',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteForm.isPending}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteForm.isPending}
            onClick={() => deleteForm.mutate({ id: form.id })}
          >
            {deleteForm.isPending ? t('Deleting…') : t('Delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

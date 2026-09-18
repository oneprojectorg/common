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

interface CustomFormsPanelProps {
  /** The decision's own profile; null on instances that never got one. */
  profileId: string | null;
  phases: AdminDecisionPhase[];
}

/** Platform-admin editor for the custom forms attached to a decision process. */
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

  const isEvery = phases.every((phase) =>
    occupiedPhaseIds.includes(phase.phaseId),
  );
  const canAdd = phases.length > 0 && !isEvery;

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
        {phases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('This decision has no phases to attach a form to.')}
          </p>
        ) : !canAdd ? (
          <p className="text-sm text-muted-foreground">
            {t('Every phase already has a form.')}
          </p>
        ) : null}
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
  const fieldCount = Object.keys(
    isRecord(form.schema.properties) ? form.schema.properties : {},
  ).length;
  const phase = phases.find((entry) => entry.phaseId === form.phaseId);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{form.name}</span>
        <span className="truncate text-sm text-muted-foreground">
          {t('{count, plural, one {# field} other {# fields}}', {
            count: fieldCount,
          })}
        </span>
      </div>
      {form.phaseId ? (
        // A phase the instance no longer configures still shows, by its raw id
        // — hiding the row would hide a form participants can still be served.
        <Badge variant={phase ? 'secondary' : 'outline'}>
          {phase?.name ?? form.phaseId}
        </Badge>
      ) : (
        <Badge variant="outline">{t('No phase')}</Badge>
      )}
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
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('Delete {name}', { name: form.name })}
        onClick={() => setIsOpen(true)}
      >
        <LuTrash2 />
      </Button>
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

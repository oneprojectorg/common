'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import { logger } from '@op/logging/client';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { Field, FieldLabel } from '@op/sense/Field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { toast } from '@op/sense/Toast';
import { type ReactNode, useId, useMemo, useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface StewardOption {
  id: string;
  name: string;
  avatarImageName?: string | null;
}

/** The draft hero's steward name as a menu of the profiles you administer. Renders `fallback` when you may not change it. */
export function ProcessAdminStewardMenu({
  slug,
  instance,
  name,
  fallback,
}: {
  slug: string;
  instance: ProcessInstance;
  name: string;
  fallback: ReactNode;
}) {
  const t = useTranslations('decisions.processAdmin');
  const hintId = useId();
  const { options, canChange } = useStewardOptions(instance);
  const { save, isPending } = useSaveSteward(slug, instance.id);

  if (!canChange) {
    return fallback;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="bare"
              disabled={isPending}
              aria-describedby={hintId}
              className="h-auto gap-1 rounded-md px-1.5 py-0.5 text-base font-normal underline hover:bg-muted"
            />
          }
        >
          <bdi>{name}</bdi>
          <LuChevronDown className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.id}
              disabled={option.id === instance.steward?.id}
              onClick={() => save(option.id)}
            >
              <StewardAvatar option={option} />
              <bdi>{option.name}</bdi>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span id={hintId} className="sr-only">
        {t('changeStewardLabel')}
      </span>
    </>
  );
}

/** Settings → Process details: the same choice as a labelled select for a live process. */
export function ProcessAdminStewardSelect({
  slug,
  instance,
}: {
  slug: string;
  instance: ProcessInstance;
}) {
  const t = useTranslations('decisions.processAdmin');
  const selectId = useId();
  const { options, canChange } = useStewardOptions(instance);
  const { save, isPending } = useSaveSteward(slug, instance.id);
  // Holds the choice until the refetch lands, so the select does not jump back.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const stewardId = instance.steward?.id ?? null;
  if (pendingId !== null && !isPending && pendingId === stewardId) {
    setPendingId(null);
  }

  return (
    <Field>
      <FieldLabel htmlFor={selectId}>{t('stewardLabel')}</FieldLabel>
      <Select
        value={pendingId ?? stewardId}
        disabled={!canChange || isPending}
        onValueChange={(value) => {
          if (typeof value === 'string' && value !== stewardId) {
            setPendingId(value);
            save(value);
          }
        }}
        // Without `items`, SelectValue renders the raw id.
        items={Object.fromEntries(
          options.map((option) => [option.id, option.name]),
        )}
      >
        <SelectTrigger id={selectId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <StewardAvatar option={option} />
                <bdi>{option.name}</bdi>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function StewardAvatar({ option }: { option: StewardOption }) {
  return (
    <Avatar className="size-6 shrink-0">
      {option.avatarImageName ? (
        <AvatarImage
          src={getPublicUrl(option.avatarImageName) ?? undefined}
          alt=""
        />
      ) : null}
      <AvatarFallback>{option.name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

// The caller's own profile and the organisations they administer, plus the
// current steward so the control never shows a blank. Only an admin of the
// owning profile may change it.
function useStewardOptions(instance: ProcessInstance): {
  options: StewardOption[];
  canChange: boolean;
} {
  const [{ items: userProfiles }] =
    trpc.account.getUserProfiles.useSuspenseQuery();
  const steward = instance.steward;
  const ownerId = instance.owner?.id;

  const options = useMemo(() => {
    const items: StewardOption[] = userProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      avatarImageName: profile.avatarImage?.name,
    }));
    if (steward && !items.some((item) => item.id === steward.id)) {
      items.push({
        id: steward.id,
        name: steward.name,
        avatarImageName: steward.avatarImage?.name,
      });
    }
    return items;
  }, [userProfiles, steward]);

  const canChange =
    ownerId !== undefined &&
    userProfiles.some((profile) => profile.id === ownerId);

  return { options, canChange };
}

function useSaveSteward(slug: string, instanceId: string) {
  const t = useTranslations('decisions.processAdmin');
  const utils = trpc.useUtils();
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: async () => {
      await utils.decision.getDecisionBySlug.invalidate({ slug });
    },
    onError: (error) => {
      logger.error('Process steward change failed', { error });
      toast.error(t('saveError'));
    },
  });

  return {
    save: (stewardProfileId: string) =>
      updateInstance.mutate({ instanceId, stewardProfileId }),
    isPending: updateInstance.isPending,
  };
}

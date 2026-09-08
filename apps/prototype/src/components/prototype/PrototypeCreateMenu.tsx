'use client';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { toast } from '@op/sense/Toast';
import { screens } from '@op/styles/constants';
import { useState } from 'react';
import { LuMessageCircle, LuPlus, LuUserPlus, LuUsers } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { PrototypeCreateProcessModal } from './PrototypeCreateProcessModal';
import { PROTOTYPE_STEWARDS } from './fakeUser';
import {
  type PrototypeProcess,
  duplicateProcess,
  loadProcesses,
  saveDraft,
  userCreatedCount,
} from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The real `CreateMenu`, with the decision-making process option pointed at the
 * prototype wizard and the other two options stubbed. This is the entry point
 * the handoff note asks for: Create → Decision-making process.
 */
export function PrototypeCreateMenu() {
  const t = useTranslations();
  const router = useRouter();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  /* Read when the modal opens rather than on mount: a process created earlier
     in the session has to count, and this component never unmounts. */
  const [processes, setProcesses] = useState<PrototypeProcess[]>([]);

  const startProcess = () => {
    // Nothing of your own to duplicate yet, so there is nothing to choose
    // between — the wizard is the only real answer and the modal would be a
    // screen asking you to pick it.
    if (userCreatedCount() === 0) {
      router.push('/prototype/decisions/new');

      return;
    }

    /* Newest first — the picker shows three, and the one worth duplicating is
       almost always the one just run. Left in store order the two that ship
       with the prototype would take two of the three slots forever. */
    setProcesses([...loadProcesses()].reverse());
    setIsCreateOpen(true);
  };

  const openBlank = () => {
    const id = saveDraft(
      {
        type: 'other',
        shape: 'blank',
        name: t('Untitled process'),
        steward: PROTOTYPE_STEWARDS[0].name,
        audience: 'anyone',
        pieces: [],
      },
      [],
    );

    setIsCreateOpen(false);
    router.push(`/prototype/decisions/${id}`);
  };

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger
        render={
          <Button variant="default" size={isMobile ? 'icon' : 'default'} />
        }
      >
        <LuPlus className="size-4" />
        <span className="hidden sm:block">{t('Create')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          // Deliberately untranslated: prototype-only debug affordance.
          onClick={() =>
            toast.info('Prototype: organizations are out of scope')
          }
        >
          <LuUsers className="size-4" /> {t('Organization')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={startProcess}>
          <LuMessageCircle className="size-4" /> {t('Decision-making process')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => toast.info('Prototype: inviting is out of scope')}
        >
          <LuUserPlus className="size-4" /> {t('Invite member')}
        </DropdownMenuItem>
      </DropdownMenuContent>

      <PrototypeCreateProcessModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        processes={processes}
        onGuided={() => {
          setIsCreateOpen(false);
          router.push('/prototype/decisions/new');
        }}
        onBlank={openBlank}
        onDuplicate={(source, name, steward) => {
          const id = duplicateProcess(source, name, steward);

          setIsCreateOpen(false);
          toast.success(`Prototype: duplicated "${source.name}"`);
          router.push(`/prototype/decisions/${id}`);
        }}
      />
    </DropdownMenu>
  );
}

'use client';

import { Button } from '@op/ui/Button';
import { useQueryState } from 'nuqs';
import { LuChevronRight, LuCircleAlert, LuHouse, LuPlus } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { UserAvatarMenu } from '@/components/SiteHeader';

export const ProcessBuilderHeader = ({
  steps,
}: {
  steps?: { id: string; label: string }[];
}) => {
  const [currentStep, setCurrentStep] = useQueryState('step');
  return (
    <header className="relative flex h-14 w-dvw items-center justify-between border-b">
      <div className="relative z-10 flex items-center gap-2 pl-4 md:pl-8">
        <Link href="/" className="flex items-center gap-2 text-primary">
          <LuHouse className="size-4" />
          Home
        </Link>
        <LuChevronRight className="size-4" />
        <span>New process</span>
      </div>
      <nav className="absolute z-0 hidden h-full w-full justify-center gap-2 md:flex">
        {steps &&
          steps?.length > 0 &&
          steps.map((step) => (
            <button
              key={step.id}
              className={`cursor-pointer border-b border-transparent px-2 text-neutral-gray4 hover:border-neutral-400 hover:text-black data-active:border-black data-active:text-black`}
              id={step.id}
              onClick={() => setCurrentStep(step.id)}
              data-active={step.id === currentStep ? true : undefined}
            >
              {step.label}
            </button>
          ))}
      </nav>
      <div className="relative z-10 flex gap-4 pr-4 md:pr-8">
        {steps && steps.length > 0 && (
          <div className="flex gap-2">
            <Button
              className="flex aspect-square h-8 gap-2 rounded-sm md:aspect-auto"
              color="warn"
            >
              <LuCircleAlert className="size-4 shrink-0" />
              <span className="hidden md:block">3 steps remaining</span>
            </Button>
            <Button className="h-8 rounded-sm">
              <LuPlus className="size-4" />
              Launch<span className="hidden md:inline"> Process</span>
            </Button>
          </div>
        )}
        <UserAvatarMenu className="hidden md:block" />
      </div>
    </header>
  );
};

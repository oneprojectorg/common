'use client';

import { trpc } from '@op/api/client';
import { DecisionProcess } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Header1, Header2 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { LuSparkles } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { GenerateProcessModal } from './GenerateProcessModal';

export const ProcessBuilderProcessSelector = () => {
  const t = useTranslations();

  return (
    <div className="size-full grow p-4 sm:p-8">
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto rounded-lg border bg-neutral-offWhite p-4 md:gap-8 md:p-8">
        <Header1 className="text-center">
          {t('How do you want to structure your decision-making process?')}
        </Header1>
        <div className="flex w-full flex-wrap items-stretch justify-center gap-4">
          <Suspense fallback={<TemplateListSkeleton />}>
            <TemplateList />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

const TemplateList = () => {
  const router = useRouter();
  const t = useTranslations();
  const [templatesData] = trpc.decision.listProcesses.useSuspenseQuery({});
  const templates = templatesData?.processes;
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  const createDecisionInstance =
    trpc.decision.createInstanceFromTemplate.useMutation({
      onSuccess: (data) => {
        router.push(`/decisions/${data.slug}/edit`);
      },
    });

  return (
    <>
      <button
        className="flex w-full cursor-pointer flex-col gap-2 rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-left transition-shadow hover:border-neutral-400 hover:shadow-md sm:w-72 md:aspect-[4/3] md:w-[360px] md:p-12 md:text-center"
        onClick={() => setIsGenerateModalOpen(true)}
      >
        <div className="flex gap-2 md:flex-col md:items-center md:gap-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-green1/20 md:size-20">
            <LuSparkles className="size-5 text-primary-green1 md:size-8" />
          </div>
          <Header2 className="font-serif text-xl leading-6 font-light">
            {t('Describe your process')}
          </Header2>
        </div>
        <p className="text-neutral-gray4">
          {t(
            "Tell us about your decision-making process and we'll create a template for you.",
          )}
        </p>
      </button>

      {templates?.map((template) => (
        <ProcessBuilderProcessCard
          key={template.id}
          template={template}
          onSelect={() => {
            createDecisionInstance.mutate({
              templateId: template.id,
              name: `New ${template.name}`,
            });
          }}
        />
      ))}

      <GenerateProcessModal
        isOpen={isGenerateModalOpen}
        onOpenChange={setIsGenerateModalOpen}
      />
    </>
  );
};

export const ProcessBuilderProcessCard = ({
  template,
  onSelect,
}: {
  template: DecisionProcess;
  onSelect: () => void;
}) => {
  const { name, description } = template;

  return (
    <button
      className="flex w-full cursor-pointer flex-col gap-2 rounded-lg border bg-white p-6 text-left transition-shadow hover:border-neutral-300 hover:shadow-md sm:w-72 md:aspect-[4/3] md:w-[360px] md:p-12 md:text-center"
      onClick={onSelect}
    >
      <div className="flex gap-2 md:flex-col md:items-center md:gap-6">
        <Avatar className="shrink-0 md:size-20">{}</Avatar>
        <Header2 className="font-serif text-xl leading-6 font-light">
          {name}
        </Header2>
      </div>
      <p className="text-neutral-gray4">{description}</p>
    </button>
  );
};

const TemplateCardSkeleton = () => {
  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-lg border bg-white p-6 sm:w-72 sm:items-center md:aspect-[4/3] md:w-90 md:p-12">
      <div className="flex gap-2 md:flex-col md:items-center md:gap-6">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="flex gap-2 md:flex-col md:items-center">
        <Skeleton className="h-3 w-60" />
        <Skeleton className="h-3 w-50" />
      </div>
    </div>
  );
};

const TemplateListSkeleton = () => {
  return (
    <>
      <TemplateCardSkeleton />
      <TemplateCardSkeleton />
    </>
  );
};

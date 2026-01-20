'use client';

import { trpc } from '@op/api/client';
import { decisionProcessWithSchemaEncoder } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Header1, Header2 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

type DecisionProcess = z.infer<typeof decisionProcessWithSchemaEncoder>;

export const ProcessBuilderProcessSelector = () => {
  // Get available templates
  const { data: templatesData, isLoading: isLoadingTemplates } =
    trpc.decision.listProcesses.useQuery({});
  const templates = templatesData?.processes;
  const t = useTranslations();

  return (
    <div className="size-full p-4 sm:p-8">
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto rounded-lg border bg-neutral-offWhite p-4 md:gap-8 md:p-8">
        <Header1 className="text-center">
          {t('How do you want to structure your decision-making process?')}
        </Header1>
        <div className="flex w-full flex-wrap items-stretch justify-center gap-4">
          {isLoadingTemplates ? (
            <>
              <ProcessCardSkeleton />
              <ProcessCardSkeleton />
            </>
          ) : (
            <ProcessSelector templates={templates} />
          )}
        </div>
      </div>
    </div>
  );
};

const ProcessSelector = ({ templates }: { templates?: DecisionProcess[] }) => {
  const router = useRouter();
  const createDecisionInstance =
    trpc.decision.createInstanceFromTemplate.useMutation({
      onSuccess: (data) => {
        router.push(`/decisions/edit/${data.slug}`);
      },
    });

  const t = useTranslations();

  if (!templates?.length) {
    return (
      <div className="grid aspect-square h-64 items-center rounded-lg border bg-white text-center">
        <p>{t('No templates found')}</p>
      </div>
    );
  }

  return Object.values(templates).map((template) => (
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
  ));
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

const ProcessCardSkeleton = () => {
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

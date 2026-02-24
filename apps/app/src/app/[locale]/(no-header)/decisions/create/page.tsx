import { createClient } from '@op/api/serverClient';
import { redirect } from 'next/navigation';

const CreateDecisionPage = async () => {
  const client = await createClient();

  const { processes: templates } = await client.decision.listProcesses({});

  const firstTemplate = templates[0];
  if (!firstTemplate) {
    redirect('/decisions');
  }

  const decisionProfile = await client.decision.createInstanceFromTemplate({
    templateId: firstTemplate.id,
    name: `New ${firstTemplate.name}`,
  });

  redirect(`/decisions/${decisionProfile.slug}/edit`);
};

export default CreateDecisionPage;

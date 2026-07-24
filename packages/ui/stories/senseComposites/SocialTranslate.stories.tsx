import { SocialLinks } from '@op/sense/SocialLinks';
import { TranslateBanner } from '@op/sense/TranslateBanner';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { SocialLinksFooter as OldSocialLinks } from '../../src/components/SocialLinks';
import { TranslateBanner as OldTranslateBanner } from '../../src/components/TranslateBanner';

const meta: Meta = {
  title: 'Sense Comparison/Composites/Social & translate',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const SocialTranslateComparison: Story = {
  name: 'Social & translate',
  render: () => (
    <div className="p-8">
      <Section title="SocialLinks">
        <Pair
          label="Icon links"
          old={<OldSocialLinks />}
          raw={<SocialLinks />}
        />
      </Section>
      <Section title="TranslateBanner">
        <Pair
          label="CTA banner"
          old={
            <OldTranslateBanner
              label="Translate to English"
              onTranslate={() => {}}
              onDismiss={() => {}}
            />
          }
          raw={
            <TranslateBanner
              label="Translate to English"
              onTranslate={() => {}}
              onDismiss={() => {}}
            />
          }
        />
      </Section>
    </div>
  ),
};

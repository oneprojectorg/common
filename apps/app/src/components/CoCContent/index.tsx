import { Header3 } from '@op/ui/Header';

import { FormalSection } from '../FormalSection';

export const CoCContent = () => {
  return (
    <div className="relative flex w-full flex-col gap-8 sm:pb-20">
      <FormalSection>
        <Header3 className="font-serif">Who We Are</Header3>
        <p>
          Common is a digital platform that connects people, organizations, and
          resources to coordinate and grow economic democracy to global scale.
          The Common platform is run by One Project. One Project is a nonprofit
          building infrastructure for a new economy where resources serve people
          and planet, not profit. We partner with the rising global movement for
          economic democracy to build core technology, mobilize catalytic
          resources, and show the world that a better system is possible today.
        </p>
        <p>
          On the Common Platform, we are committed to creating a respectful,
          inclusive and safe environment for all users. This code of conduct
          outlines the expectations for all users of the Common platform.
        </p>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">Expected Behavior</Header3>
        <p>
          Treat Everyone with Respect and Consideration (adopted from DisCO
          Caring Community Guidelines): Be kind, understanding, and
          compassionate to each other. Be welcoming. Be aware of how we use
          language. This is especially important when discussing sensitive
          topics where misunderstandings and stereotypes can be exacerbated.
          Remember we're here to support, learn, and collaborate with each other
          to grow a democratic economy.
        </p>
        <p>
          Be Respectful of Privacy: Respect the privacy and confidentiality of
          others. If there are sensitive partnerships, obtain permission before
          making them visible on the platform.
        </p>
        <p>
          Build Robust Relationships: Build strong, resilient connections that
          strengthen collaboration, deepen existing partnerships, and enable new
          relationships to emerge.
        </p>
        <p>
          Inclusive Network Development: Wherever possible, try to amplify the
          voice and needs of smaller local organizations that may initially have
          limited connections as they start to engage new collaborations on the
          network.
        </p>
        <p>
          Center Affected Communities (adopted from New Economy Coalition
          Connect Agreements): Recognize and respect the expertise, leadership,
          and lived experiences of communities most impacted by economic
          inequality. Actively make space for their voices, defer to their
          guidance on issues affecting them directly, and acknowledge their
          essential role in developing meaningful solutions.
        </p>
        <p>
          Share from Your Own Experiences (adopted from New Economy Coalition
          Connect Agreements): Be sure to share information and perspectives
          from your experiences rather than making assumptions about or speaking
          on behalf of others. When sharing information, clearly distinguish
          among personal knowledge, organizational position/perspective, and
          third-party information.
        </p>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">Prohibited Behavior</Header3>
        <p>The following behaviors are considered unacceptable:</p>
        <p>
          Posting content that is abusive, insulting, threatening,
          discriminatory, or that promotes or encourages hatred, racism, sexism,
          or bigotry towards any group.
        </p>
        <p>
          Engaging in behavior intended to harass, upset, embarrass, alarm, or
          annoy others.
        </p>
        <p>
          Encouraging, depicting, facilitating, or participating in any harmful
          activities that may endanger platform users and their networks.
        </p>
        <p>
          Sharing false or misleading information that could damage someone's
          reputation.
        </p>
        <p>Sharing the personal information of others without their consent.</p>
        <p>
          Engaging in commercial activities (including, without limitation,
          sales, competitions, promotions, and advertising).
        </p>
        <p>
          Violations of the code of conduct may result in temporary suspension
          or permanent account termination. If you witness or experience any
          behavior that violates this Code of Conduct please contact
          support@oneproject.org. This Code of Conduct will be updated and
          evolved in collaboration with partners.
        </p>
      </FormalSection>

      <FormalSection>
        <p>
          Last updated: June 18, 2025. Questions? Contact us at:
          support@oneproject.org
        </p>
      </FormalSection>
    </div>
  );
};

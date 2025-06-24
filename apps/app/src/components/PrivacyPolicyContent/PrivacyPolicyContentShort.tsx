import { Header3 } from '@op/ui/Header';

import { FormalSection } from '../FormalSection';

export const PrivacyPolicyContentShort = () => {
  return (
    <div className="relative flex w-full flex-col gap-8 sm:pb-20">
      <FormalSection>
        <p className="italic">
          This is a summarized version of our Privacy Policy. Please read the
          full legal version in the dropdown below for complete details.
        </p>
      </FormalSection>
      <FormalSection>
        <Header3 className="font-serif">1. Who We Are</Header3>
        <p>
          Common is a digital platform that connects people, organizations, and
          resources to coordinate and grow economic democracy to global scale.
          The Common platform is run by One Project. One Project is a nonprofit
          building infrastructure for a new economy, where resources serve
          people and planet, not profit. We partner with the rising global
          movement for economic democracy to build core technology, mobilize
          catalytic resources, and show the world that a better system is
          possible today.
        </p>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">2. What Data We Collect</Header3>
        <p>
          All of the information we collect is in service of running the
          platform. We aim to collect the bare minimum to run the platform. The
          following are the categories of information that we collect:
        </p>
        <p>
          <strong>Basic Information:</strong> Profile information including
          name, username, email, organization details (mission, focus areas,
          preferred language, locations), and images that you post about your
          organization.
        </p>
        <p>
          <strong>Activity Data:</strong> Communications with us including when
          you contact us with feedback or questions. Platform usage including
          posts on the platform, relational connections, visits to a certain
          page, interaction with a certain function, IP address which may
          identify your location, etc. All of this data is anonymized and only
          collected in service of improving the platform.
        </p>
        <p>
          <strong>Self-Disclosed Financial Information (if applicable):</strong>{' '}
          Funding-related information (i.e., funding relationships, and in the
          future funding amounts for those that opt-in).
        </p>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">3. Where We Get the Data</Header3>
        <p>
          We get most of this data from you directly. As a user, you provide
          this data when you create an account on Common. We will also get some
          data from publicly available sources where you provide data. We use
          this data to help make creating a profile easier.
        </p>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">4. How We Use Data</Header3>
        <p>
          All of the data we collect is in service of running the platform and
          improving the offerings and functionality.
        </p>
        <ul>
          <li>To improve the Common Platform tools</li>
          <li>
            To help you collaborate and connect with other organizations in the
            new economy ecosystem
          </li>
          <li>To communicate with you about platform updates</li>
          <li>To protect the security of the platform</li>
          <li>To fulfill our legal obligations</li>
        </ul>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">5. Your Rights</Header3>
        <p>You have full control over your personal information on Common.</p>
        <ul>
          <li>You always own your data</li>
          <li>You can access, correct, or delete your information</li>
          <li>You can request removal of all your data from Common</li>
          <li>You can opt out of communications</li>
        </ul>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">6. Data Security</Header3>
        <p>
          While no digital service can guarantee absolute security, securing the
          data collected on the platform is a top priority. Here are some of the
          practices and mechanisms we are putting in place to protect your data:
        </p>
        <p>
          Common will only be accessible to invited partners and will remain a
          closed network for the foreseeable future.
        </p>
        <p>
          We have a robust security system that is in compliance with industry
          standards, in addition we will be conducting regular security reviews
          of our code and platform to proactively identify any potentially
          suspicious activity.
        </p>
        <p>
          We are setting up infrastructure to be in compliance with all privacy
          policy laws, both global and U.S.
        </p>
        <p>
          We keep your personal information only as long as needed for the
          purposes we collected it, or as required by law.
        </p>
        <p>
          All of the data shared on Common is encrypted during transit and at
          rest. It is stored in a double encrypted database, which is accessible
          to only a few key internal staff.
        </p>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">7. Third-Party Sharing</Header3>
        <p>
          We take a strict approach to sharing your personal information and
          only do so with your consent.
        </p>
        <ul>
          <li>We never sell, rent, or monetize your data</li>
          <li>We only share your data with your explicit opt-in consent</li>
          <li>
            We choose trusted third-party service providers to support our
            platform
          </li>
        </ul>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">8. Legal Protection</Header3>
        <p>
          We will never share your data with a legal authority unless we are
          legally compelled to via a legal subpoena. We will notify you if this
          happens, unless legally obliged not to.
        </p>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">9. Changes to This Policy</Header3>
        <p>
          We'll notify you 30 days before any significant changes. Major changes
          will be open for community feedback.
        </p>
        <p>
          Last updated: June 18, 2025. Questions? Contact us at:
          privacy@oneproject.org
        </p>
      </FormalSection>
    </div>
  );
};

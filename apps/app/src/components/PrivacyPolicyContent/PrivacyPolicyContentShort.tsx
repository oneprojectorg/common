import { Header3 } from '@op/ui/Header';

import { FormalSection } from '../FormalSection';

export const PrivacyPolicyContentShort = () => {
  return (
    <div className="relative flex w-full flex-col gap-8 sm:pb-20">
      <FormalSection>
        <p className="italic">
          This is a summarized version of our Privacy Policy. Please read the
          full legal version below for complete details.
        </p>
      </FormalSection>
      <FormalSection>
        <Header3 className="font-serif">Who We Are</Header3>
        <p className="mb-4">
          Common is a digital platform that connects people, organizations, and
          resources to coordinate and grow economic democracy to global scale.
          The Common platform is run by One Project. One Project is a nonprofit
          building infrastructure for a new economy, where resources serve
          people and planet, not profit. We partner with the rising global
          movement for economic democracy to build core technology, mobilize
          catalytic resources, and show the world that a better system is
          possible today. You can view the full legal version of our privacy
          policy{' '}
          <a href="/info/privacy" target="_blank">
            here
          </a>
          .
        </p>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">What Data We Collect</Header3>
        <p className="mb-4">
          All of the information we collect is in service of running the
          platform. We aim to collect the bare minimum to run the platform. The
          following are the categories of information that we collect:
        </p>
        <ul className="mb-4 list-disc pl-6">
          <li className="mb-4">
            Basic Information - Profile information including name, username,
            email, organization details (mission, focus areas, preferred
            language, locations), and images that you post about your
            organization.
          </li>
          <li className="mb-2">
            Activity Data - Communications with us including when you contact us
            with feedback or questions. Platform usage including posts on the
            platform, relational connections, visits to a certain page,
            interaction with a certain function, IP address which may identify
            your location, etc. All of this data is anonymized and only
            collected in service of improving the platform.
          </li>

          <li className="mb-4">
            Self-Disclosed Financial Information (if applicable) -
            Funding-related information (i.e., funding relationships, and in the
            future funding amounts for those that opt-in).
          </li>
        </ul>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">Where We Get the Data</Header3>
        <p className="mb-4">
          We get most of this data from you directly. As a user, you provide
          this data when you create an account on Common. We will also get some
          data from publicly available sources where you provide data. We use
          this data to help make creating a profile easier.
        </p>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">How We Use Data</Header3>
        <p className="mb-4">
          All of the data we collect is in service of running the platform and
          improving the offerings and functionality.
        </p>
        <ul className="mb-4 list-disc pl-6">
          <li className="mb-2">To improve the Common Platform tools</li>
          <li className="mb-2">
            To help you collaborate and connect with other organizations in the
            new economy ecosystem
          </li>
          <li className="mb-2">
            To communicate with you about platform updates
          </li>
          <li className="mb-2">To protect the security of the platform</li>
          <li className="mb-2">To fulfill our legal obligations</li>
        </ul>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">Your Rights</Header3>
        <p className="mb-4">
          You have full control over your personal information on Common.
        </p>
        <ul className="mb-4 list-disc pl-6">
          <li className="mb-2">You always own your data</li>
          <li className="mb-2">
            You can access, correct, or delete your information
          </li>
          <li className="mb-2">
            You can request removal of all your data from Common
          </li>
          <li className="mb-2">You can opt out of communications</li>
        </ul>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">Data Security</Header3>
        <p className="mb-4">
          While no digital service can guarantee absolute security, securing the
          data collected on the platform is a top priority. Here are some of the
          practices and mechanisms we are putting in place to protect your data:
        </p>
        <ul className="mb-4 list-disc pl-6">
          <li className="mb-2">
            Common will only be accessible to invited partners and will remain a
            closed network for the foreseeable future.
          </li>
          <li className="mb-2">
            We have a robust security system that is in compliance with industry
            standards, in addition we will be conducting regular security
            reviews of our code and platform to proactively identify any
            potentially suspicious activity.
          </li>
          <li className="mb-2">
            We are setting up infrastructure to be in compliance with all
            privacy policy laws, both global and U.S.
          </li>
          <li className="mb-2">
            We keep your personal information only as long as needed for the
            purposes we collected it, or as required by law
          </li>
          <li className="mb-2">
            All of the data shared on Common is encrypted during transit and at
            rest. It is stored in a double encrypted database, which is
            accessible to only a few key internal staff.
          </li>
        </ul>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">Third-Party Sharing</Header3>
        <p className="mb-4">
          We take a strict approach to sharing your personal information and
          only do so with your consent.
        </p>
        <ul className="mb-4 list-disc pl-6">
          <li className="mb-2">We never sell, rent, or monetize your data</li>
          <li className="mb-2">
            We only share your data with your explicit opt-in consent.
          </li>
          <li className="mb-2">
            We choose trusted third-party service providers to support our
            platform
          </li>
        </ul>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">Legal Protection</Header3>
        <p className="mb-4">
          We will not share your data with a legal authority unless we are
          legally compelled to via a legal subpoena. We will notify you if this
          happens, unless legally obliged not to.
        </p>
      </FormalSection>

      <FormalSection>
        <Header3 className="font-serif">Changes to This Policy</Header3>
        <ul className="mb-4 list-disc pl-6">
          <li className="mb-2">
            We'll notify you 30 days before any significant changes
          </li>
          <li className="mb-2">
            Major changes will be open for community feedback
          </li>
        </ul>
      </FormalSection>
    </div>
  );
};

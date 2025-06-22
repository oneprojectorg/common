import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import * as React from 'react';

import TailwindConfig from '../tailwind.config';

const EmailTemplate = ({
  children,
  previewText,
}: {
  children: React.ReactNode;
  previewText: string;
}) => {
  return (
    <Tailwind config={TailwindConfig}>
      <Html>
        <Head>
          <meta name="color-scheme" content="light" />
          <meta name="supported-color-schemes" content="light" />
          <Font
            fontFamily="Roboto"
            fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
            webFont={{
              url: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',
              format: 'woff2',
            }}
            fontWeight={400}
            fontStyle="normal"
          />
        </Head>
        <Preview>{previewText}</Preview>

        <Body className="m-auto rounded-[16px] bg-[#FAFBFB] p-8 font-sans text-neutral-600">
          <Container className="mt-4 max-w-[648px] p-12 md:mt-10">
            <Container className="mx-auto w-full rounded-lg border border-solid border-[#EDEEEE] bg-white p-12 md:max-w-[600px]">
              <Section>
                <Row>
                  <Column align="left">
                    <Link href="https://oneproject.org">
                      <Row>
                        <Column align="left" width={24}>
                          <Img
                            src="https://common.oneproject.org/Common.png"
                            width="64"
                            height="12"
                          />
                        </Column>
                      </Row>
                    </Link>
                  </Column>
                </Row>
              </Section>

              <Container className="mt-6">{children}</Container>
            </Container>
            <Container className="mx-auto max-w-[600px] px-12 py-8">
              <Text className="mb-0 text-[12px]">
                Common is maintained by One Project.
              </Text>
              <Text className="mb-0 mt-2 text-[12px]">
                You’re receiving this email as part of our authentication and
                communication processes.
              </Text>
            </Container>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

export default EmailTemplate;

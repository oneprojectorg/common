import * as React from 'react';
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
} from 'react-email';

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
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&family=Roboto+Serif:ital,opsz,wght@0,8..144,100..900;1,8..144,100..900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap"
            rel="stylesheet"
          />
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

        <Body className="text-neutral-charcoal m-auto bg-[#FAFBFB] p-4 font-sans">
          <Container className="mt-4 max-w-[648px] md:mt-10">
            <Container className="mx-auto w-full max-w-[600px] rounded-lg border border-solid border-neutral-200 bg-white p-8">
              <Section>
                <Row>
                  <Column align="left">
                    <Link href="https://common.oneproject.org">
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

              <Section className="mt-8">{children}</Section>
            </Container>
            <Container className="mx-auto mb-0 max-w-[600px] p-8 font-sans font-normal">
              <Text className="mt-0 mb-0 text-sm">
                Common is maintained by One Project.
              </Text>
              <Text className="mt-2 mb-0 text-sm">
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

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

        <Body className="p-8 m-auto rounded-[16px] bg-[#FAFBFB] font-sans text-sm leading-[150%] text-neutral-charcoal">
          <Container className="mt-4 p-12 md:mt-10 max-w-[648px]">
            <Container className="p-12 md:max-w-[600px] mx-auto w-full rounded-lg border border-solid bg-white">
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

              <Container className="mt-8">{children}</Container>
            </Container>
            <Container className="mb-0 px-12 py-8 font-normal mx-auto max-w-[600px] font-sans">
              <Text className="mb-0 mt-0 text-xs">
                Common is maintained by One Project.
              </Text>
              <Text className="mb-0 mt-2 text-xs">
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

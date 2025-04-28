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

        <Body className="m-auto rounded-[16px] bg-white font-sans text-neutral-600">
          <Container className="max-w-[648px]">
            <Container
              className="mt-4 max-w-[648px] pb-4 md:mt-10"
              style={{
                backgroundImage:
                  'url("https://oneproject.tech/email-box-shadow-compressed.png")',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '98% 105%',
                backgroundPosition: 'center',
              }}
            >
              <Container className="mx-auto w-full rounded-[16px] border-2 border-solid border-neutral-300 bg-neutral-50 p-4 md:max-w-[600px] md:p-8">
                <Section>
                  <Row>
                    <Column align="left">
                      <Link href="https://oneproject.org">
                        <Row>
                          <Column align="left" width={24}>
                            <Img
                              src="https://oneproject.tech/email-logo.png"
                              width="24"
                              height="24"
                            />
                          </Column>
                          <Column
                            align="left"
                            className="font hidden pl-2 pt-0.5 align-bottom text-base leading-[24px] text-neutral-600 md:table-cell"
                          >
                            One Project
                          </Column>
                        </Row>
                      </Link>
                    </Column>

                    <Column align="right">
                      <Text className="!my-0 font-mono text-[10px] leading-[14px] text-neutral-600">
                        Co-creating Alternatives.
                        <br />
                        Global Networks.
                      </Text>
                    </Column>
                  </Row>
                </Section>

                <Container className="mt-12">{children}</Container>
              </Container>
            </Container>
            <Container className="mx-auto max-w-[600px]">
              {/* <Hr className="mx-0 w-full border border-solid border-neutral-300" /> */}
              <Text className="mb-0 mt-6 text-center text-[12px] font-bold leading-[12px] text-neutral-400">
                One Project Org, {new Date().getFullYear()}
              </Text>
              <Text className="mb-0 mt-2 text-center text-[12px] leading-[12px] text-neutral-400">
                You’re receiving this email as part of our <br />
                authentication and communication processes.
              </Text>

              <Link href="https://oneproject.org">
                <Img
                  src="https://oneproject.tech/email-logo.png"
                  width="20"
                  height="20"
                  className="mx-auto mt-4"
                />
              </Link>
            </Container>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

export default EmailTemplate;

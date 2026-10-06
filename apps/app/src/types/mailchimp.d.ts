/** The slice of the untyped Mailchimp Marketing client the waitlist uses. */
declare module '@mailchimp/mailchimp_marketing' {
  interface ListMember {
    email_address: string;
    status: 'subscribed';
    merge_fields: Record<string, string | undefined>;
    tags: Array<string>;
  }

  const mailchimp: {
    setConfig(config: {
      apiKey: string | undefined;
      server: string | undefined;
    }): void;
    lists: {
      setListMember(
        listId: string | undefined,
        subscriberHash: string,
        member: ListMember,
      ): Promise<{ status: number }>;
    };
  };

  export default mailchimp;
}

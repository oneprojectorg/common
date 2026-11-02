// `@op/analytics` builds its PostHog client on import, which needs a key.
export const analyticsClientMock = {
  default: () => ({
    capture() {},
    identify() {},
    async isFeatureEnabled() {
      return false;
    },
    async getAllFlags() {
      return {};
    },
    async shutdown() {},
  }),
};

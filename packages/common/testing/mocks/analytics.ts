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

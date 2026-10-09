export default function PostHogClient() {
  return {
    capture() {},
    identify() {},
    async isFeatureEnabled() {
      return false;
    },
    async shutdown() {},
  };
}

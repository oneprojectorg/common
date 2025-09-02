/**
 * Check if a specific module is enabled for a profile
 * @param modules Array of enabled modules
 * @param moduleSlug The slug of the module to check for
 * @returns true if the module is enabled, false otherwise
 */
export const checkModuleEnabled = (
  modules: Array<{ slug: string }> | undefined,
  moduleSlug: string,
): boolean => {
  if (!modules) {
    return false;
  }

  return modules.some((module) => module.slug === moduleSlug);
};

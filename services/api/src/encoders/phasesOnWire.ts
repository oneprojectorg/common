// TODO: remove when the client reads phases off the instance instead of instanceData.

/** A copy of `instanceData` carrying `phases`; a non-object is left as is. */
export const putPhasesOnInstanceData = ({
  instanceData,
  phases,
}: {
  instanceData: unknown;
  phases: unknown;
}): unknown =>
  typeof instanceData === 'object' && instanceData !== null
    ? { ...instanceData, phases }
    : instanceData;

/**
 * Sends a resolved instance's `phases` as `instanceData.phases`, where the
 * client reads them. An instance that was never resolved keeps its blob.
 */
export const withPhasesOnWire = (instance: unknown): unknown =>
  typeof instance === 'object' &&
  instance !== null &&
  'phases' in instance &&
  'instanceData' in instance
    ? {
        ...instance,
        instanceData: putPhasesOnInstanceData({
          instanceData: instance.instanceData,
          phases: instance.phases,
        }),
      }
    : instance;

// keeps track of individual users
const idToRequestCount = new Map<
  string,
  { accessCount: number; windowStart: number | undefined }
>();

const rateLimited = (
  ip: string,
  reqUrl: string,
  windowSize = 10,
  maxRequests = 10,
) => {
  // Construct a unique key based on path and IP
  const key = `${ip}-${reqUrl}`;

  // Check and update current window
  const now = Date.now();

  const notAccessedBefore = !idToRequestCount.get(key)?.windowStart;

  // Initialize the window if it's the first time
  if (notAccessedBefore) {
    idToRequestCount.set(key, { windowStart: now, accessCount: 0 });
  }

  // Get the window start time
  let windowStart = idToRequestCount.get(key)?.windowStart as number;

  // Check if the current window has expired
  const isNewWindow = now - windowStart > windowSize * 1000;

  // Reset the window if it has expired
  if (isNewWindow) {
    idToRequestCount.set(key, { windowStart: Date.now(), accessCount: 0 });
  }

  // Get the window start time again, IN CASE IT WAS RESET
  windowStart = idToRequestCount.get(key)?.windowStart as number;

  // Calculate the time to refresh the window
  const timeToRefresh = windowStart + windowSize * 1000 - Date.now();

  const currentRequestCount = idToRequestCount.get(key)?.accessCount ?? 0;

  // Check and update current request limits
  if (currentRequestCount >= maxRequests) {
    return { status: true, timeToRefresh };
  }

  idToRequestCount.set(key, {
    windowStart,
    accessCount: currentRequestCount + 1,
  });

  return { status: false, timeToRefresh };
};

export default rateLimited;

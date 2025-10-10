import { getHandler } from '@op/workflows';

// Mounts the handler for our @op/workflows package to handle event-driven workflows and tasks
export const { GET, POST, PUT } = getHandler();

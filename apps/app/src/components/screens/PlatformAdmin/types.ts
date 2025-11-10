import type { RouterOutput } from '@op/api/client';

type ListAllUsersOutput = RouterOutput['platform']['admin']['listAllUsers'];
export type User = ListAllUsersOutput['items'][number];

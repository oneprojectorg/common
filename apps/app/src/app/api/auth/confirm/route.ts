
import { NextResponse } from 'next/server';

import { OPURLConfig } from '@op/core';

export const GET = async () => {
  const useUrl = OPURLConfig('APP');

  return NextResponse.redirect(useUrl.ENV_URL);
};

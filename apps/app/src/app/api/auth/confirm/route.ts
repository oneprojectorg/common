import { OPURLConfig } from '@op/core';
import { NextResponse } from 'next/server';

export const GET = async () => {
  const useUrl = OPURLConfig('APP');

  return NextResponse.redirect(useUrl.ENV_URL);
};

import { OPURLConfig } from '@op/core';
import { NextResponse } from 'next/server';

const useUrl = OPURLConfig('APP');

export const GET = async () => {
  return NextResponse.redirect(new URL('/', useUrl.ENV_URL));
};

import { SetMetadata } from '@nestjs/common';
export const PUBLIC_KEY = 'isPublic';
/** Marks a route as not requiring the service API key (e.g. health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

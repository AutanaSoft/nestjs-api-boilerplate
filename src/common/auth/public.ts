import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE = Symbol('PUBLIC_ROUTE');

/** Explicitly exempts a controller or handler from the global access-token guard. */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

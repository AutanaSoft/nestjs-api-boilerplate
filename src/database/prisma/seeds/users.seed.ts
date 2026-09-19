import type { PrismaClient } from '../../generated/client.js';

/**
 * Reserves the users seed boundary without creating default users or credentials.
 */
export async function seedUsers(client: PrismaClient): Promise<void> {
  void client;
}

import { randomBytes } from "node:crypto";

/**
 * Generates an unguessable token for the public /ar/:token route. The token
 * itself carries no information -- it is only ever resolved by exact,
 * database-backed lookup against a PUBLISHED model, so there is nothing to
 * forge even if the random value were predictable (it isn't: 24 bytes from
 * the OS CSPRNG).
 */
export function generateArToken(): string {
  return randomBytes(24).toString("base64url");
}

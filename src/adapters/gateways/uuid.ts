const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identifier columns are UUID in the database. A string outside that shape makes
 * the driver throw a syntax error, which would surface as a 500 in the API.
 * Since a malformed identifier simply does not exist, the gateways treat it as
 * "not found" and return null, preserving the 404.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

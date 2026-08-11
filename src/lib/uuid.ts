const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ids reach services from route params and Server Action arguments, both user-controlled:
 *  a non-UUID would abort the query with a Postgres 22P02 instead of a domain-level miss. */
export const isUuid = (value: string): boolean => UUID_RE.test(value)

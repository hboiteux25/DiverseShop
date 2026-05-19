import { z } from "zod"

const POSTGRES_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function postgresUuid(message: string) {
  return z.string().trim().regex(POSTGRES_UUID_PATTERN, message)
}

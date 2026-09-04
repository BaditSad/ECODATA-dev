import { z } from "zod";

/**
 * Environment access.
 *
 * Server secrets are read lazily rather than at module load: importing this
 * file from a client component must never throw because `SUPABASE_SERVICE_ROLE_KEY`
 * is absent from the browser bundle. Each accessor validates only what it needs.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  GUEST_SESSION_SECRET: z.string().min(32),
  SENSOR_API_KEY_PEPPER: z.string().min(32),
  SUPER_ADMIN_EMAIL: z.string().email().default("admin@ecodatalink.com"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function fail(scope: string, error: z.ZodError): never {
  const detail = error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  throw new Error(
    `Invalid ${scope} environment configuration — ${detail}. See .env.example.`
  );
}

let publicCache: PublicEnv | null = null;

export function publicEnv(): PublicEnv {
  if (publicCache) return publicCache;

  // Inlined at build time by Next, so these must be referenced literally.
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) fail("public", parsed.error);
  publicCache = parsed.data;
  return publicCache;
}

let serverCache: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (serverCache) return serverCache;

  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must never be called in the browser.");
  }

  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GUEST_SESSION_SECRET: process.env.GUEST_SESSION_SECRET,
    SENSOR_API_KEY_PEPPER: process.env.SENSOR_API_KEY_PEPPER,
    SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL,
  });

  if (!parsed.success) fail("server", parsed.error);
  serverCache = parsed.data;
  return serverCache;
}

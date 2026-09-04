"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TYPE } from "@/components/console/ui";

/**
 * Staff email/password sign-in.
 *
 * Signs in on the client so `@supabase/ssr` writes the session cookies, then
 * hands off with `router.refresh()`. The destination is decided by middleware
 * from the freshly loaded role, not here: a client-side guess would race the
 * profile lookup and could send a resort manager to `/admin` for one frame.
 */
export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Only same-origin absolute paths, so `?from=` cannot become an open redirect. */
  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      // Deliberately generic: distinguishing "no such user" from "wrong
      // password" would confirm which addresses have accounts.
      setError("Those credentials were not recognised.");
      setPending(false);
      return;
    }

    router.replace(safeRedirect ?? "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="console-card px-4 py-4">
      <label className="block">
        <span className={TYPE.eyebrow}>Work email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="console-input mt-1.5 h-9"
        />
      </label>

      <label className="mt-3 block">
        <span className={TYPE.eyebrow}>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="console-input mt-1.5 h-9"
        />
      </label>

      {error ? (
        <p
          className="mt-3 font-sans text-[11px]"
          style={{ color: "var(--bt-danger)" }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !email || !password}
        className="console-btn-primary mt-4 w-full"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className={`mt-4 ${TYPE.meta}`}>
        Resort guest?{" "}
        <Link href="/client/login" className="underline underline-offset-2">
          Enter your four-digit code
        </Link>
      </p>
    </form>
  );
}

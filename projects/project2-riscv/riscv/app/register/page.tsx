"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Libre_Baskerville, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { registerUser } from "./api/frontend";
import {
  ASUID_INVALID_MESSAGE,
  isValidAsuid,
  normalizeAsuidInput,
} from "@/app/lib/asuid";

const fontUniversity = Libre_Baskerville({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const fontUi = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const fontProduct = Outfit({
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [asuid, setAsuid] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const trimmedUsername = username.trim();
  const normalizedAsuid = normalizeAsuidInput(asuid);
  const hasValidAsuid = isValidAsuid(normalizedAsuid);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit =
    trimmedUsername.length > 0 &&
    hasValidAsuid &&
    password.length > 0 &&
    passwordsMatch;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!hasValidAsuid) {
      setError(ASUID_INVALID_MESSAGE);
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await registerUser(
        trimmedUsername,
        normalizedAsuid,
        password,
        confirmPassword
      );

      if (result.success) {
        router.push(
          `/login?registered=1&username=${encodeURIComponent(trimmedUsername)}`
        );
        return;
      }

      setError(result.message || "Registration failed");
    } catch (submitError) {
      console.error("Registration error:", submitError);
      setError("An error occurred during registration");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`${fontUi.className} flex min-h-screen flex-col bg-gradient-to-b from-[#fffef9] via-[#fff4e0] to-[#ffeccd] lg:flex-row`}
    >
      <aside
        className="relative hidden min-h-0 shrink-0 flex-col overflow-hidden border-amber-100/90 bg-gradient-to-br from-[#fffbf0] via-[#fff4dc] to-[#ffe8c4] text-stone-900 lg:flex lg:w-[42%] lg:max-w-xl lg:border-r"
        aria-label="AssemblerLab registration branding"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-100"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 95% 65% at 50% 10%, rgba(254, 243, 199, 0.55), transparent 55%),
              radial-gradient(ellipse 70% 50% at 0% 100%, rgba(253, 186, 116, 0.12), transparent 50%)
            `,
          }}
        />
        <div className="relative z-10 flex min-h-screen flex-col px-10 py-10 lg:px-12 lg:py-12">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-8">
            <div className="flex w-full max-w-md flex-col items-center text-center">
              <p
                className={`${fontUniversity.className} text-[0.7rem] font-bold tracking-[0.24em] text-amber-900/90 sm:text-xs`}
              >
                Arizona State University
              </p>

              <div className="relative mt-8 w-full max-w-[min(100%,320px)] overflow-hidden rounded-2xl shadow-lg shadow-amber-900/15 ring-1 ring-amber-200/90">
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src="/login/assembly-hero.jpg"
                    alt="Printed circuit board and processor"
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 320px, 100vw"
                    priority
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-amber-50/40 via-transparent to-amber-100/20"
                    aria-hidden
                  />
                </div>
              </div>

              <h1
                className={`${fontProduct.className} mt-8 text-5xl font-bold leading-[1.05] tracking-tight text-stone-900 sm:text-6xl lg:text-7xl xl:text-[4.5rem]`}
              >
                Create Account
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-stone-600 sm:text-lg">
                Student self-registration for AssemblerLab. Staff accounts are still created by instructors.
              </p>
            </div>
          </div>

          <p className="relative shrink-0 text-center text-sm text-stone-600">
            Student registration only
          </p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col justify-center bg-gradient-to-b from-[#fffef9]/90 via-[#fff8ec] to-[#ffeccd]/80 px-4 py-12 sm:px-8 lg:py-0">
        <div className="mx-auto w-full max-w-[460px]">
          <div className="mb-8 text-center lg:hidden">
            <p
              className={`${fontUniversity.className} text-[0.65rem] font-bold tracking-[0.2em] text-amber-900/85`}
            >
              Arizona State University
            </p>
            <h1
              className={`${fontProduct.className} mt-3 text-3xl font-bold tracking-tight text-stone-900`}
            >
              AssemblerLab
            </h1>
          </div>

          <div className="rounded-2xl border border-amber-200/90 bg-white p-7 shadow-lg shadow-amber-950/10 ring-1 ring-amber-100 sm:p-9">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                Register
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
                New student account
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                Create a student login with your username, ASUID, and password.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="username"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-700"
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/35"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label
                    htmlFor="asuid"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-700"
                  >
                    ASU ID
                  </label>
                  <input
                    id="asuid"
                    name="asuid"
                    type="text"
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/35"
                    placeholder="10-digit ASUID"
                    value={asuid}
                    onChange={(event) =>
                      setAsuid(normalizeAsuidInput(event.target.value))
                    }
                    disabled={isSubmitting}
                  />
                  <p className="mt-2 text-xs text-stone-600">
                    {asuid.length === 0
                      ? "ASUID is required for every new account."
                      : hasValidAsuid
                        ? "Valid 10-digit ASUID."
                        : ASUID_INVALID_MESSAGE}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-700"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/35"
                    placeholder="Create a password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-700"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/35"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={isSubmitting}
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="mt-2 text-xs text-red-700">Passwords do not match.</p>
                  )}
                </div>
              </div>

              {error && (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-900"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-orange-900/20 transition hover:from-amber-600 hover:to-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {isSubmitting ? "Creating account…" : "Register"}
              </button>
            </form>

            <div className="mt-6 flex justify-center">
              <Link
                href="/login"
                className="text-sm font-semibold text-amber-800 transition hover:text-orange-700"
              >
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

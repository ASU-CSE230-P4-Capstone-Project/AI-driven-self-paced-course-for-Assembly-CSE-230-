'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Libre_Baskerville, Plus_Jakarta_Sans, Outfit } from 'next/font/google';
import { login } from './api/frontend';

const fontUniversity = Libre_Baskerville({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const fontUi = Plus_Jakarta_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const fontProduct = Outfit({
  weight: ['600', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [portal, setPortal] = useState<'student' | 'admin'>('student');
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'authenticating' | 'redirecting'>(
    'idle'
  );
  const [error, setError] = useState('');
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const isAdminPortal = portal === 'admin';
  const isLoading = submitPhase !== 'idle' || isPending;
  const loadingTitle =
    submitPhase === 'redirecting'
      ? isAdminPortal
        ? 'Signed in. Opening staff dashboard...'
        : 'Signed in. Opening your workspace...'
      : 'Signing you in...';

  useEffect(() => {
    router.prefetch('/register');
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const registered = params.get('registered') === '1';
    const registeredUsername = params.get('username')?.trim() ?? '';

    if (!registered) {
      setRegistrationMessage('');
      return;
    }

    setRegistrationMessage(
      registeredUsername
        ? `Account created for ${registeredUsername}. Sign in through Student Login.`
        : 'Account created. Sign in through Student Login.'
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitPhase('authenticating');
    setError('');

    try {
      const result = await login(username, password, portal);

      if (result.success) {
        let redirectPath: string | null = null;
        if (result.instructor) {
          redirectPath = '/instructor';
        } else if (result.ta) {
          redirectPath = '/ta';
        } else if (result.student) {
          redirectPath = '/student';
        }

        if (redirectPath) {
          setSubmitPhase('redirecting');
          startTransition(() => {
            router.push(redirectPath);
          });
          return;
        } else {
          setSubmitPhase('idle');
          setError('Unable to determine account role for sign-in.');
        }
      } else {
        setSubmitPhase('idle');
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setSubmitPhase('idle');
      setError('An error occurred during login');
      console.error('Login error:', err);
    }
  };

  return (
    <div
      className={`${fontUi.className} flex min-h-screen flex-col bg-gradient-to-b from-[#fffef9] via-[#fff4e0] to-[#ffeccd] lg:flex-row`}
    >
      {/* Brand panel — light warm theme, hero centered */}
      <aside
        className="relative hidden min-h-0 shrink-0 flex-col overflow-hidden border-amber-100/90 bg-gradient-to-br from-[#fffbf0] via-[#fff4dc] to-[#ffe8c4] text-stone-900 lg:flex lg:w-[42%] lg:max-w-xl lg:border-r"
        aria-label="AssemblerLab branding"
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
                    alt="Printed circuit board and processor — low-level computing"
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
                AssemblerLab
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-stone-600 sm:text-lg">
                RISC-V assembly workspace for courses—edit, simulate, and submit in one place.
              </p>
            </div>
          </div>

          <p className="relative shrink-0 text-center text-sm text-stone-600">
            Capstone learning environment
          </p>
        </div>
      </aside>

      {/* Form column */}
      <main className="flex flex-1 flex-col justify-center bg-gradient-to-b from-[#fffef9]/90 via-[#fff8ec] to-[#ffeccd]/80 px-4 py-12 sm:px-8 lg:py-0">
        <div className="mx-auto w-full max-w-[420px]">
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
                Sign in
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
                {isAdminPortal ? 'Staff' : 'Student'} access
              </h2>
            </div>

            <div
              className="mb-8 flex rounded-xl bg-amber-100/80 p-1"
              role="group"
              aria-label="Portal"
            >
              <button
                type="button"
                onClick={() => setPortal('student')}
                disabled={isLoading}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  portal === 'student'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                } disabled:opacity-50`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setPortal('admin')}
                disabled={isLoading}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  portal === 'admin'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                } disabled:opacity-50`}
              >
                Instructor / TA
              </button>
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
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                  />
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
                    autoComplete="current-password"
                    className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/35"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {registrationMessage && (
                <div
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-900"
                  role="status"
                >
                  {registrationMessage}
                </div>
              )}

              {isLoading && (
                <div
                  className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-amber-700"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-amber-950">{loadingTitle}</p>
                    </div>
                  </div>
                </div>
              )}

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
                disabled={isLoading}
                className="relative flex w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {isAdminPortal ? 'Sign in as staff' : 'Sign in'}
              </button>

              <Link
                href="/register"
                aria-disabled={isLoading}
                tabIndex={isLoading ? -1 : undefined}
                className={`flex w-full items-center justify-center rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 hover:text-stone-900 ${
                  isLoading ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                Register new student account
              </Link>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

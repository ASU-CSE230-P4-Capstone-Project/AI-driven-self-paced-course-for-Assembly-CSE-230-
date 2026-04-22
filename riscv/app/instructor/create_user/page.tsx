'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createUser } from './api/frontend';
import { ins } from '@/components/instructor-shell';
import type { CreateUserRole } from './api/types';
import {
  ASUID_INVALID_MESSAGE,
  isValidAsuid,
  normalizeAsuidInput,
} from '@/app/lib/asuid';

const roleOptions: Array<{
  value: CreateUserRole;
  label: string;
  description: string;
}> = [
  {
    value: 'student',
    label: 'Student',
    description: 'Standard student account with student portal access.',
  },
  {
    value: 'ta',
    label: 'TA',
    description: 'Creates the account now; TA admin access becomes active after course-role assignment.',
  },
  {
    value: 'instructor',
    label: 'Instructor',
    description: 'Full instructor account with instructor dashboard access.',
  },
];

export default function CreateUserPage() {
  const [username, setUsername] = useState('');
  const [asuid, setAsuid] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<CreateUserRole>('student');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);
  const trimmedUsername = username.trim();
  const normalizedAsuid = normalizeAsuidInput(asuid);
  const hasValidAsuid = isValidAsuid(normalizedAsuid);
  const canSubmit =
    trimmedUsername.length > 0 && password.length > 0 && hasValidAsuid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setMessage({
        success: false,
        text: ASUID_INVALID_MESSAGE,
      });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await createUser(trimmedUsername, normalizedAsuid, password, role);
      setMessage({ success: result.success, text: result.message });

      if (result.success) {
        setUsername('');
        setAsuid('');
        setPassword('');
        setRole('student');
      }
    } catch (error) {
      setMessage({
        success: false,
        text: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${ins.pageWrapSm} max-w-md`}>
      <Link href="/instructor" className={ins.backLink}>
        ← Back to dashboard
      </Link>
      <h1 className={`${ins.h1} mt-4 text-center`}>Create User</h1>

      {message && (
        <div className={`mt-4 ${message.success ? ins.msgOk : ins.msgErr}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className={`mt-6 space-y-4 ${ins.card} ${ins.cardPad}`}>
        <div>
          <label htmlFor="username" className={ins.label}>
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className={ins.input}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className={ins.label}>
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className={ins.input}
            required
          />
        </div>

        <div>
          <label htmlFor="asuid" className={ins.label}>
            ASU ID
          </label>
          <input
            type="text"
            id="asuid"
            name="asuid"
            value={asuid}
            onChange={(e) => setAsuid(normalizeAsuidInput(e.target.value))}
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            placeholder="10-digit ASUID"
            autoComplete="off"
            className={ins.input}
            required
          />
          <p className="mt-2 text-xs text-stone-600">
            {asuid.length === 0
              ? 'Every new user account must include a 10-digit ASUID.'
              : hasValidAsuid
                ? 'Valid 10-digit ASUID.'
                : ASUID_INVALID_MESSAGE}
          </p>
        </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium mb-1">
              Account Type
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as CreateUserRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-600">
              {roleOptions.find((option) => option.value === role)?.description}
            </p>
          </div>

        <button
          type="submit"
          disabled={isSubmitting || !canSubmit}
          className={`${ins.btnPrimary} w-full disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isSubmitting ? 'Creating...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}

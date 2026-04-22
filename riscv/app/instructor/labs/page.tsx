'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listLabs } from '@/app/api/list_labs/frontend';
import { createLab } from '@/app/api/create_lab/frontend';
import { deleteLab } from '@/app/api/delete_lab/frontend';
import { Lab } from '@/app/api/list_labs/types';
import { ins } from '@/components/instructor-shell';

export default function InstructorLabsPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLabName, setNewLabName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadLabs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listLabs();

      if (response.success && response.labs) {
        setLabs(response.labs);
      } else {
        setError(response.message || 'Failed to fetch labs');
      }
    } catch (err) {
      setError('An error occurred while fetching labs');
      console.error('Error fetching labs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabs();
  }, []);

  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newLabName.trim()) {
      alert('Please enter a lab name');
      return;
    }

    try {
      setCreating(true);
      const response = await createLab(newLabName.trim());

      if (response.success && response.lab) {
        await loadLabs();
        setNewLabName('');
      } else {
        alert(response.message || 'Failed to create lab');
      }
    } catch (err) {
      console.error('Error creating lab:', err);
      alert('An error occurred while creating the lab');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLab = async (uid: string, title: string) => {
    if (!confirm(`Are you sure you want to delete the lab "${title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await deleteLab(uid);

      if (response.success) {
        await loadLabs();
      } else {
        alert(response.message || 'Failed to delete lab');
      }
    } catch (err) {
      console.error('Error deleting lab:', err);
      alert('An error occurred while deleting the lab');
    }
  };

  const header = (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className={ins.kicker}>Instructor</p>
        <h1 className={`${ins.h1} mt-1`}>Lab Management</h1>
        <p className={ins.subtitle}>Create and manage labs for your course.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/instructor" className={ins.btnSecondary}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={ins.pageWrap}>
        {header}
        <div className={`${ins.card} ${ins.cardPad} flex flex-col items-center py-10`}>
          <div className={ins.spinner} />
          <p className="mt-4 text-sm text-stone-600">Loading labs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={ins.pageWrap}>
        {header}
        <div className={`${ins.msgErr} border-red-500/40`} role="alert">
          <strong className="font-semibold text-red-100">Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className={ins.pageWrap}>
      {header}

      <section id="labs" className={`${ins.card} overflow-hidden`}>
        <div className="flex flex-col gap-2 border-b border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className={ins.h2Card}>Labs</h2>
            <p className="text-sm text-stone-600">{labs.length} total</p>
          </div>
        </div>
        {labs.length === 0 ? (
          <div className="p-6 text-sm text-stone-600">No labs available.</div>
        ) : (
          <ul className={ins.divideList}>
            {labs.map((lab) => (
              <li
                key={lab.uid}
                className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={`/instructor/edit_lab/${lab.uid}`} className="group flex-1">
                  <div>
                    <p className={`text-base font-semibold ${ins.linkAccent}`}>{lab.title}</p>
                    <p className="text-xs text-stone-600">Click to edit lab details</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDeleteLab(lab.uid, lab.title)}
                  className={ins.btnDangerSolid}
                  aria-label={`Delete ${lab.title}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="create-lab" className={`${ins.card} ${ins.cardPad}`}>
        <h2 className={ins.h2Card}>Create New Lab</h2>
        <p className={`${ins.subtitleMuted} mt-1`}>
          Set up a new lab shell. You can add instructions and test cases after creation.
        </p>
        <form onSubmit={handleCreateLab} className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="labName" className={ins.label}>
              Lab Name
            </label>
            <input
              type="text"
              id="labName"
              value={newLabName}
              onChange={(e) => setNewLabName(e.target.value)}
              className={ins.input}
              placeholder="Enter lab name"
              disabled={creating}
            />
          </div>
          <button
            type="submit"
            disabled={creating || !newLabName.trim()}
            className={
              creating || !newLabName.trim() ? ins.btnDisabled : ins.btnPrimary
            }
          >
            {creating ? 'Creating...' : 'Create Lab'}
          </button>
        </form>
      </section>
    </div>
  );
}

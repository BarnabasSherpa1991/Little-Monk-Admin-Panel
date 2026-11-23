import React, { useMemo, useState } from 'react';
import { CheckCircle2, MessageSquare, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { FollowUp } from '../../types/crm';
import {
  buildWhatsAppLink,
  formatDate,
  isOverdueDate,
  isTodayDate,
  todayISO,
} from '../../utils/formatters';
import { SearchInput } from '../common/DataTableToolbar';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const FollowUpsView: React.FC = () => {
  const { followUps, employees, can, saveFollowUp, deleteFollowUp, currentEmployee } = useCRM();

  const [segment, setSegment] = useState<'today' | 'overdue' | 'upcoming' | 'completed'>('today');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Partial<FollowUp>>({});
  const [historyModal, setHistoryModal] = useState<FollowUp | null>(null);
  const [newLogNote, setNewLogNote] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const todayCount = followUps.filter((f) => f.status === 'Pending' && isTodayDate(f.dueDate)).length;
    const overdueCount = followUps.filter((f) => f.status === 'Pending' && isOverdueDate(f.dueDate)).length;
    const upcomingCount = followUps.filter(
      (f) => f.status === 'Pending' && f.dueDate > todayISO()
    ).length;
    const completedCount = followUps.filter((f) => f.status === 'Completed').length;
    return { todayCount, overdueCount, upcomingCount, completedCount };
  }, [followUps]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return followUps.filter((f) => {
      if (segment === 'today' && !(f.status === 'Pending' && isTodayDate(f.dueDate))) return false;
      if (segment === 'overdue' && !(f.status === 'Pending' && isOverdueDate(f.dueDate))) return false;
      if (segment === 'upcoming' && !(f.status === 'Pending' && f.dueDate > todayISO())) return false;
      if (segment === 'completed' && f.status !== 'Completed') return false;
      if (term) {
        const hay = `${f.title} ${f.customerName || ''} ${f.relatedEntityCode || ''} ${f.assignedToName || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [followUps, segment, search]);

  const openCreate = () => {
    setForm({
      title: '',
      type: 'Enquiry Follow-up',
      customerName: '',
      customerPhone: '',
      dueDate: todayISO(),
      reminderTime: '11:00',
      priority: 'High',
      status: 'Pending',
      assignedToUid: currentEmployee?.uid || '',
      assignedToName: currentEmployee?.name || '',
      notes: '',
    });
    setFormOpen(true);
  };

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.title?.trim()) return;
    const emp = employees.find((e) => e.uid === form.assignedToUid);
    await saveFollowUp({
      ...form,
      assignedToName: emp?.name || currentEmployee?.name || 'Staff',
    });
    setFormOpen(false);
  };

  const handleAddHistoryNote = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!historyModal || !newLogNote.trim()) return;
    const nextHistory = [
      ...(historyModal.history || []),
      {
        note: newLogNote.trim(),
        by: currentEmployee?.name || 'Staff',
        at: new Date().toLocaleString('en-IN'),
      },
    ].slice(0, 30);
    await saveFollowUp({ history: nextHistory }, historyModal.id);
    setHistoryModal({ ...historyModal, history: nextHistory });
    setNewLogNote('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setSegment('today')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                segment === 'today' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Today ({counts.todayCount})
            </button>
            <button
              type="button"
              onClick={() => setSegment('overdue')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                segment === 'overdue' ? 'bg-red-600 text-white shadow-xs' : 'text-red-600 dark:text-red-400'
              }`}
            >
              Overdue ({counts.overdueCount})
            </button>
            <button
              type="button"
              onClick={() => setSegment('upcoming')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                segment === 'upcoming' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Upcoming ({counts.upcomingCount})
            </button>
            <button
              type="button"
              onClick={() => setSegment('completed')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                segment === 'completed' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Completed ({counts.completedCount})
            </button>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tasks, customer..." className="w-64" />
        </div>
        {can('followups', 'create') && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Follow-up Task
          </button>
        )}
      </div>

      {/* Tasks List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No follow-ups in this category.
          </div>
        ) : (
          filtered.map((f) => (
            <div key={f.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{f.title}</span>
                  <span className="text-xs text-slate-400">·</span>
                  <span
                    className={`text-xs font-medium ${
                      f.priority === 'Urgent' || f.priority === 'High'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {f.priority} Priority
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                  <span>{f.type}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    Due {formatDate(f.dueDate)} {f.reminderTime ? `at ${f.reminderTime}` : ''}
                  </span>
                  {f.customerName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{f.customerName}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>Assigned: {f.assignedToName || 'Staff'}</span>
                </div>
                {f.notes && (
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">{f.notes}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {f.customerPhone && (
                  <a
                    href={buildWhatsAppLink(
                      f.customerPhone,
                      `Hello ${f.customerName || ''}, following up from Azure Travel regarding: ${f.title}`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setHistoryModal(f)}
                  className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Notes ({(f.history || []).length})
                </button>
                {can('followups', 'edit') && (
                  <button
                    type="button"
                    onClick={() =>
                      saveFollowUp(
                        { status: f.status === 'Completed' ? 'Pending' : 'Completed' },
                        f.id
                      )
                    }
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg ${
                      f.status === 'Completed'
                        ? 'border border-slate-200 dark:border-slate-700 text-slate-600'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {f.status === 'Completed' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reopen
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Complete
                      </>
                    )}
                  </button>
                )}
                {can('followups', 'delete') && (
                  <button
                    type="button"
                    onClick={() => setDeleteId(f.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Task Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold">Schedule Follow-up Task</h3>
              <button type="button" onClick={() => setFormOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Task Title *</label>
                <input
                  required
                  type="text"
                  value={form.title || ''}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Task Type</label>
                  <select
                    value={form.type || 'Enquiry Follow-up'}
                    onChange={(e) => setForm({ ...form, type: e.target.value as FollowUp['type'] })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="Enquiry Follow-up">Enquiry Follow-up</option>
                    <option value="Payment Reminder">Payment Reminder</option>
                    <option value="Pre-Tour Check">Pre-Tour Check</option>
                    <option value="Post-Tour Feedback">Post-Tour Feedback</option>
                    <option value="Internal Task">Internal Task</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Priority</label>
                  <select
                    value={form.priority || 'High'}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as FollowUp['priority'] })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={form.customerName || ''}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Customer Phone</label>
                  <input
                    type="text"
                    value={form.customerPhone || ''}
                    onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Due Date *</label>
                  <input
                    required
                    type="date"
                    value={form.dueDate || todayISO()}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Reminder Time</label>
                  <input
                    type="time"
                    value={form.reminderTime || '11:00'}
                    onChange={(e) => setForm({ ...form, reminderTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Assign To Employee</label>
                <select
                  value={form.assignedToUid || ''}
                  onChange={(e) => setForm({ ...form, assignedToUid: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                >
                  {employees.map((emp) => (
                    <option key={emp.uid} value={emp.uid}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm border rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Follow-up History Modal */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold truncate">{historyModal.title}</h3>
              <button type="button" onClick={() => setHistoryModal(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <form onSubmit={handleAddHistoryNote} className="flex gap-2">
                <input
                  type="text"
                  value={newLogNote}
                  onChange={(e) => setNewLogNote(e.target.value)}
                  placeholder="Add follow-up outcome note..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                />
                <button type="submit" className="px-3 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg">
                  Log
                </button>
              </form>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(historyModal.history || []).length === 0 ? (
                  <p className="text-xs text-slate-500">No history notes added yet.</p>
                ) : (
                  (historyModal.history || []).map((h, i) => (
                    <div key={i} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                      <div className="text-slate-400 mb-0.5">{h.by} · {h.at}</div>
                      <div className="text-slate-800 dark:text-slate-200">{h.note}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Follow-up"
        message="Are you sure you want to delete this follow-up task?"
        confirmLabel="Delete"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await deleteFollowUp(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
};

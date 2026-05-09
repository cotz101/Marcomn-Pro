'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Briefcase, Plus, Trash2, X, Check, Loader, Pencil } from 'lucide-react';

const EMPTY_JOB = {
  title: '',
  company: '',
  location: '',
  start_date: '',
  end_date: '',
  description: '',
};

function JobFormModal({ initial = EMPTY_JOB, onSave, onClose, saving, mode = 'add' }) {
  const [form, setForm] = useState(initial);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{mode === 'add' ? 'Add position' : 'Edit position'}</h2>
          <button className="btn-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Job Title *</label>
              <input type="text" name="title" className="form-input" value={form.title} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Company *</label>
              <input type="text" name="company" className="form-input" value={form.company} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label>Location</label>
              <input type="text" name="location" className="form-input" value={form.location || ''} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Start Date</label>
              <input type="month" name="start_date" className="form-input"
                value={form.start_date ? form.start_date.slice(0, 7) : ''} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>End Date <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(blank = present)</span></label>
              <input type="month" name="end_date" className="form-input"
                value={form.end_date ? form.end_date.slice(0, 7) : ''} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label>Description</label>
            <textarea
              name="description"
              className="form-textarea"
              rows={4}
              placeholder="Describe your responsibilities and achievements…"
              value={form.description || ''}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)} disabled={saving || !form.title.trim() || !form.company.trim()}>
            {saving ? <Loader size={16} /> : <><Check size={15} style={{ marginRight: 6 }} />{mode === 'add' ? 'Add' : 'Save changes'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExperienceSection({ userId, isOwnProfile }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState(null); // null | 'add' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState('');

  const supabase = createClient();

  // DATE columns require YYYY-MM-DD; <input type="month"> gives YYYY-MM, so we append -01
  const toDateStr = (val) => (val && val.length === 7 ? `${val}-01` : val || null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchJobs = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('experience')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false, nullsFirst: false });
    setJobs(data || []);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleAdd = async (form) => {
    setSaving(true);
    const { error } = await supabase.from('experience').insert({
      user_id: userId,
      title: form.title,
      company: form.company,
      location: form.location || null,
      start_date: toDateStr(form.start_date),
      end_date: toDateStr(form.end_date),
      description: form.description || null,
    });
    if (!error) { await fetchJobs(); setModalMode(null); showToast('Position added!'); }
    else showToast('Error: ' + error.message);
    setSaving(false);
  };

  const handleEdit = async (form) => {
    setSaving(true);
    const { error } = await supabase.from('experience').update({
      title: form.title,
      company: form.company,
      location: form.location || null,
      start_date: toDateStr(form.start_date),
      end_date: toDateStr(form.end_date),
      description: form.description || null,
    }).eq('id', editTarget.id);
    if (!error) { await fetchJobs(); setModalMode(null); setEditTarget(null); showToast('Position updated!'); }
    else showToast('Error: ' + error.message);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    const { error } = await supabase.from('experience').delete().eq('id', id);
    if (!error) { setJobs(prev => prev.filter(j => j.id !== id)); showToast('Position removed.'); }
    else showToast('Error: ' + error.message);
    setDeletingId(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Present';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <section className="profile-card about-card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          <Briefcase size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
          Experience
        </h2>
        {isOwnProfile && (
          <button
            onClick={() => { setEditTarget(null); setModalMode('add'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--primary-btn)', color: 'white',
              border: 'none', borderRadius: 8, padding: '7px 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Plus size={15} /> Add job
          </button>
        )}
      </div>

      {/* Job List */}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading…</p>
      ) : jobs.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No experience entries yet. Click "Add job" to get started.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {jobs.map((job, idx) => (
            <div key={job.id} style={{
              display: 'flex', gap: 16, padding: '16px 0',
              borderBottom: idx < jobs.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {/* Icon */}
              <div style={{
                width: 48, height: 48, flexShrink: 0,
                background: 'linear-gradient(135deg, #0e2a4d, #00B4D8)',
                borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Briefcase size={20} color="white" />
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{job.title}</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {job.company}{job.location ? ` · ${job.location}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {formatDate(job.start_date)} – {formatDate(job.end_date)}
                </div>
                {job.description && (
                  <p style={{ fontSize: 13, marginTop: 8, lineHeight: 1.65, color: 'var(--text-primary)' }}>
                    {job.description}
                  </p>
                )}
              </div>

              {/* Actions */}
              {isOwnProfile && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'flex-start' }}>
                  <button
                    onClick={() => { setEditTarget(job); setModalMode('edit'); }}
                    title="Edit"
                    style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                      padding: '5px 8px', cursor: 'pointer', color: 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center'
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={deletingId === job.id}
                    title="Remove"
                    style={{
                      background: 'none', border: '1px solid #fca5a5', borderRadius: 6,
                      padding: '5px 8px', cursor: 'pointer', color: '#cc0000',
                      display: 'flex', alignItems: 'center'
                    }}
                  >
                    {deletingId === job.id ? <Loader size={14} /> : <Trash2 size={14} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modalMode === 'add' && (
        <JobFormModal
          mode="add"
          onSave={handleAdd}
          onClose={() => setModalMode(null)}
          saving={saving}
        />
      )}
      {modalMode === 'edit' && editTarget && (
        <JobFormModal
          mode="edit"
          initial={editTarget}
          onSave={handleEdit}
          onClose={() => { setModalMode(null); setEditTarget(null); }}
          saving={saving}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 88, right: 20,
          background: '#0e2a4d', color: 'white',
          padding: '12px 20px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          fontSize: 14, fontWeight: 500, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <Check size={16} style={{ color: '#4ade80' }} /> {toast}
        </div>
      )}
    </section>
  );
}

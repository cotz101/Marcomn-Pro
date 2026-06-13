'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  Globe,
  EyeOff,
  Sliders,
  HelpCircle,
  Hash,
  Save,
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react';
import {
  getCMSManagementData,
  saveCMSPage,
  publishCMSPage,
  saveCMSSection,
  deleteCMSSection,
  saveCMSFAQ,
  deleteCMSFAQ,
  saveCMSVariable
} from '@/app/actions/adminCMSActions';

export default function AdminContentPage() {
  const router = useRouter();
  const { profile, showToast } = useProfile();

  // Access check
  const isLegacyAdmin = profile && ['super_admin', 'admin', 'brand_manager'].includes(profile.global_role);
  const perms = profile?.admin_permissions || [];
  const canPages = isLegacyAdmin || perms.includes('can_manage_content_pages');
  const canFaqs = isLegacyAdmin || perms.includes('can_manage_faqs');
  const isAuthorized = canPages || canFaqs;

  // Tabs
  const [activeTab, setActiveTab] = useState('pages'); // pages, sections, faqs, variables

  // Data
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const [sections, setSections] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [variables, setVariables] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState('');

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editType, setEditType] = useState(''); // page, section, faq
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Variable editing
  const [editingVarId, setEditingVarId] = useState('');
  const [editingVarValue, setEditingVarValue] = useState('');

  const loadCMSConfig = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const res = await getCMSManagementData();
      if (res.success) {
        setPages(res.pages || []);
        setSections(res.sections || []);
        setFaqs(res.faqs || []);
        setVariables(res.variables || []);
        
        // Auto-select first page if none selected
        if (res.pages && res.pages.length > 0 && !selectedPageId) {
          setSelectedPageId(res.pages[0].id);
        }
      } else {
        showToast(res.error || 'Failed to load CMS configuration.', 'error');
      }
    } catch (err) {
      showToast('An error occurred loading content configurations.', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, selectedPageId, showToast]);

  useEffect(() => {
    if (profile) {
      if (isAuthorized) {
        loadCMSConfig();
      } else {
        setLoading(false);
      }
    }
  }, [profile, isAuthorized, loadCMSConfig]);

  // Handle Tab Switch
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsEditing(false);
    setFormData({});
  };

  // Page Operations
  const handleSavePage = async (e) => {
    e.preventDefault();
    if (!canPages) {
      showToast('Unauthorized to edit pages.', 'error');
      return;
    }
    if (!formData.title || !formData.slug) {
      showToast('Title and slug are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await saveCMSPage(formData);
      if (res.success) {
        showToast(`Page "${res.page.title}" saved successfully.`, 'success');
        setIsEditing(false);
        setFormData({});
        await loadCMSConfig();
      } else {
        showToast(res.error || 'Failed to save page.', 'error');
      }
    } catch (err) {
      showToast('Error saving page configuration.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (id, title, currentStatus) => {
    if (!canPages) {
      showToast('Unauthorized to publish pages.', 'error');
      return;
    }
    try {
      const res = await publishCMSPage(id, !currentStatus);
      if (res.success) {
        showToast(`Page "${title}" ${!currentStatus ? 'published' : 'unpublished'}.`, 'success');
        await loadCMSConfig();
      } else {
        showToast(res.error || 'Failed to update page status.', 'error');
      }
    } catch (err) {
      showToast('Error toggling publication.', 'error');
    }
  };

  // Section Operations
  const handleSaveSection = async (e) => {
    e.preventDefault();
    if (!canPages) {
      showToast('Unauthorized to manage sections.', 'error');
      return;
    }
    if (!formData.title || !formData.section_key || !formData.content) {
      showToast('All fields are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await saveCMSSection({
        ...formData,
        page_id: selectedPageId
      });
      if (res.success) {
        showToast(`Section "${res.section.title}" saved successfully.`, 'success');
        setIsEditing(false);
        setFormData({});
        await loadCMSConfig();
      } else {
        showToast(res.error || 'Failed to save section.', 'error');
      }
    } catch (err) {
      showToast('Error saving section details.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSection = async (id, title) => {
    if (!canPages) {
      showToast('Unauthorized to delete sections.', 'error');
      return;
    }
    if (!confirm(`Are you sure you want to delete the section "${title}"?`)) return;

    try {
      const res = await deleteCMSSection(id);
      if (res.success) {
        showToast(`Section "${title}" deleted.`, 'success');
        await loadCMSConfig();
      } else {
        showToast(res.error || 'Failed to delete section.', 'error');
      }
    } catch (err) {
      showToast('Error deleting section.', 'error');
    }
  };

  // FAQ Operations
  const handleSaveFAQ = async (e) => {
    e.preventDefault();
    if (!canFaqs) {
      showToast('Unauthorized to manage FAQs.', 'error');
      return;
    }
    if (!formData.question || !formData.answer) {
      showToast('Question and answer are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await saveCMSFAQ({
        ...formData,
        page_id: selectedPageId || null
      });
      if (res.success) {
        showToast('FAQ saved successfully.', 'success');
        setIsEditing(false);
        setFormData({});
        await loadCMSConfig();
      } else {
        showToast(res.error || 'Failed to save FAQ.', 'error');
      }
    } catch (err) {
      showToast('Error saving FAQ details.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFAQ = async (id) => {
    if (!canFaqs) {
      showToast('Unauthorized to delete FAQs.', 'error');
      return;
    }
    if (!confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      const res = await deleteCMSFAQ(id);
      if (res.success) {
        showToast('FAQ deleted.', 'success');
        await loadCMSConfig();
      } else {
        showToast(res.error || 'Failed to delete FAQ.', 'error');
      }
    } catch (err) {
      showToast('Error deleting FAQ.', 'error');
    }
  };

  // Variable Operations
  const handleSaveVariable = async (id, key) => {
    if (!canPages) {
      showToast('Unauthorized to manage variables.', 'error');
      return;
    }
    try {
      const res = await saveCMSVariable(id, editingVarValue);
      if (res.success) {
        showToast(`Variable "${key}" updated successfully.`, 'success');
        setEditingVarId('');
        setEditingVarValue('');
        await loadCMSConfig();
      } else {
        showToast(res.error || 'Failed to update variable.', 'error');
      }
    } catch (err) {
      showToast('Error saving content variable.', 'error');
    }
  };

  // Back to Admin
  const handleBack = () => {
    router.push('/admin');
  };

  // Access Denied View
  if (!loading && !isAuthorized) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center font-sans">
        <div className="bg-white border border-gray-150 rounded-3xl p-8 shadow-md flex flex-col items-center space-y-6">
          <div className="p-4 bg-red-50 text-red-600 rounded-full">
            <XCircle size={36} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-sm text-gray-500 mt-2">
              You do not have permissions to manage website content or legal pages.
            </p>
          </div>
          <button
            onClick={handleBack}
            className="w-full bg-[#002b4e] hover:bg-[#001c33] text-white text-sm font-bold py-3 rounded-xl transition-all shadow-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Loading View
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
        <Loader2 size={36} className="animate-spin text-[#0e2a4d] mb-4" />
        <span className="text-sm text-gray-500 font-bold">Loading CMS Configurations...</span>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-6 md:py-8 pb-[calc(var(--mobile-nav-height,72px)+env(safe-area-inset-bottom)+32px)] md:pb-8 font-sans w-full">
      {/* Breadcrumbs & Title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-gray-500"
          title="Back to Admin"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider">
            <span>Admin</span>
            <span>/</span>
            <span>Global Settings</span>
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold text-[#0e2a4d] mt-0.5">
            Website Content & Legal Pages
          </h1>
        </div>
      </div>

      {/* Main Container Layout */}
      <div className="flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="bg-white border border-gray-150 p-1 rounded-2xl flex w-full shadow-3xs overflow-x-auto select-none gap-1">
          <button
            onClick={() => handleTabChange('pages')}
            className={`flex-1 py-3 px-4 text-xs font-extrabold text-center rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'pages'
                ? 'bg-[#0e2a4d] text-white shadow-3xs'
                : 'text-gray-400 hover:text-gray-600 hover:bg-slate-50'
            }`}
          >
            CMS Pages
          </button>
          <button
            onClick={() => handleTabChange('sections')}
            className={`flex-1 py-3 px-4 text-xs font-extrabold text-center rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'sections'
                ? 'bg-[#0e2a4d] text-white shadow-3xs'
                : 'text-gray-400 hover:text-gray-600 hover:bg-slate-50'
            }`}
          >
            Page Sections
          </button>
          <button
            onClick={() => handleTabChange('faqs')}
            className={`flex-1 py-3 px-4 text-xs font-extrabold text-center rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'faqs'
                ? 'bg-[#0e2a4d] text-white shadow-3xs'
                : 'text-gray-400 hover:text-gray-600 hover:bg-slate-50'
            }`}
          >
            Frequently Asked Questions
          </button>
          <button
            onClick={() => handleTabChange('variables')}
            className={`flex-1 py-3 px-4 text-xs font-extrabold text-center rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'variables'
                ? 'bg-[#0e2a4d] text-white shadow-3xs'
                : 'text-gray-400 hover:text-gray-600 hover:bg-slate-50'
            }`}
          >
            CMS Variables
          </button>
        </div>

        {/* Dynamic Editor Panel */}
        {isEditing && (
          <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-3xs relative">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">
              {formData.id ? 'Edit' : 'Create'} {editType}
            </h3>

            {editType === 'page' && (
              <form onSubmit={handleSavePage} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-extrabold text-gray-500 mb-1.5">Page Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-900 font-medium"
                    placeholder="e.g. Terms and Conditions"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-gray-500 mb-1.5">Route Slug</label>
                  <input
                    type="text"
                    required
                    disabled={!!formData.id}
                    value={formData.slug || ''}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-900 font-medium disabled:bg-slate-50 disabled:text-gray-400"
                    placeholder="e.g. legal/terms (no leading slash)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-gray-500 mb-1.5">Meta Description</label>
                  <textarea
                    rows={3}
                    value={formData.meta_description || ''}
                    onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                    className="w-full bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-900 font-medium"
                    placeholder="Provide a search engine friendly description of this page..."
                  />
                </div>
                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="is_published"
                    checked={!!formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                  />
                  <label htmlFor="is_published" className="text-xs font-bold text-gray-600 select-none">
                    Publish this page (make visible to public users)
                  </label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#0e2a4d] hover:bg-[#071c35] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-3xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting && <Loader2 size={12} className="animate-spin" />}
                    <span>Save Page</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="border border-gray-200 text-gray-500 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {editType === 'section' && (
              <form onSubmit={handleSaveSection} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-extrabold text-gray-500 mb-1.5">Section Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-900 font-medium"
                    placeholder="e.g. Refund Conditions"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-gray-500 mb-1.5">Section Key (Unique identifier)</label>
                  <input
                    type="text"
                    required
                    disabled={!!formData.id}
                    value={formData.section_key || ''}
                    onChange={(e) => setFormData({ ...formData, section_key: e.target.value })}
                    className="w-full bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-900 font-medium disabled:bg-slate-50 disabled:text-gray-400"
                    placeholder="e.g. refunds-policy-terms"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-gray-500 mb-1.5">Content (Supports variables like `{"{{support_email}}"}`)</label>
                  <textarea
                    rows={8}
                    required
                    value={formData.content || ''}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-900 font-medium"
                    placeholder="Enter CMS section content. Newlines will render as separate paragraphs on the website..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-500 mb-1.5">Sort Order</label>
                    <input
                      type="number"
                      value={formData.sort_order ?? 0}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-900 font-medium"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active ?? true}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                    />
                    <label htmlFor="is_active" className="text-xs font-bold text-gray-600 select-none">
                      Active (Display publicly)
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#0e2a4d] hover:bg-[#071c35] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-3xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting && <Loader2 size={12} className="animate-spin" />}
                    <span>Save Section</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="border border-gray-200 text-gray-500 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {editType === 'faq' && (
              <form onSubmit={handleSaveFAQ} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-extrabold text-gray-500 mb-1.5">Question</label>
                  <input
                    type="text"
                    required
                    value={formData.question || ''}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    className="w-full bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-900 font-medium"
                    placeholder="e.g. Do MCredits expire?"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-gray-500 mb-1.5">Answer</label>
                  <textarea
                    rows={4}
                    required
                    value={formData.answer || ''}
                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                    className="w-full bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-900 font-medium"
                    placeholder="Provide the answer content..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-500 mb-1.5">Sort Order</label>
                    <input
                      type="number"
                      value={formData.sort_order ?? 0}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-150 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-900 font-medium"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      id="is_published_faq"
                      checked={formData.is_published ?? true}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                    />
                    <label htmlFor="is_published_faq" className="text-xs font-bold text-gray-600 select-none">
                      Published (Display publicly)
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#0e2a4d] hover:bg-[#071c35] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-3xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting && <Loader2 size={12} className="animate-spin" />}
                    <span>Save FAQ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="border border-gray-200 text-gray-500 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab content renders */}
        {!isEditing && (
          <div>
            {/* Pages Tab */}
            {activeTab === 'pages' && (
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-3xs">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Configured CMS Pages</h2>
                    <p className="text-xs text-gray-500 mt-1">Manage high-level web pages and dynamic routes.</p>
                  </div>
                  {canPages && (
                    <button
                      onClick={() => {
                        setEditType('page');
                        setFormData({ is_published: false });
                        setIsEditing(true);
                      }}
                      className="bg-[#0e2a4d] hover:bg-[#071c35] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add Page</span>
                    </button>
                  )}
                </div>

                {pages.length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-400 font-bold border border-dashed border-gray-200 rounded-2xl">
                    No CMS pages configured.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-150 text-gray-400 font-bold">
                          <th className="py-3 px-4">Title</th>
                          <th className="py-3 px-4">Slug (Route)</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pages.map((p) => (
                          <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors font-medium text-gray-700">
                            <td className="py-3.5 px-4 font-bold text-[#0e2a4d]">{p.title}</td>
                            <td className="py-3.5 px-4 text-slate-500 font-mono">/{p.slug}</td>
                            <td className="py-3.5 px-4 text-center">
                              {p.is_published ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full select-none">
                                  <Globe size={10} /> Published
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-50 border border-gray-100 text-gray-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full select-none">
                                  <EyeOff size={10} /> Draft
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex justify-end gap-2">
                                {canPages && (
                                  <>
                                    <button
                                      onClick={() => handleTogglePublish(p.id, p.title, p.is_published)}
                                      className={`px-3 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                                        p.is_published 
                                          ? 'border-gray-200 text-gray-500 hover:bg-slate-100'
                                          : 'border-blue-200 bg-blue-50 text-[#0e2a4d] hover:bg-blue-100'
                                      }`}
                                    >
                                      {p.is_published ? 'Unpublish' : 'Publish'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditType('page');
                                        setFormData(p);
                                        setIsEditing(true);
                                      }}
                                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-900 cursor-pointer"
                                      title="Edit Page"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sections Tab */}
            {activeTab === 'sections' && (
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-3xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">CMS Page Sections</h2>
                    <p className="text-xs text-gray-500 mt-1">Configure layout blocks and content segments.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 select-none">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Page:</span>
                      <select
                        value={selectedPageId}
                        onChange={(e) => setSelectedPageId(e.target.value)}
                        className="bg-white border border-gray-150 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-900 font-bold text-[#0e2a4d]"
                      >
                        {pages.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>
                    {canPages && selectedPageId && (
                      <button
                        onClick={() => {
                          setEditType('section');
                          setFormData({ is_active: true, sort_order: (sections.filter(s => s.page_id === selectedPageId).length + 1) * 10 });
                          setIsEditing(true);
                        }}
                        className="bg-[#0e2a4d] hover:bg-[#071c35] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Add Section</span>
                      </button>
                    )}
                  </div>
                </div>

                {!selectedPageId ? (
                  <div className="text-center py-10 text-xs text-gray-400 font-bold border border-dashed border-gray-200 rounded-2xl">
                    Configure a page first before managing sections.
                  </div>
                ) : sections.filter(s => s.page_id === selectedPageId).length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-400 font-bold border border-dashed border-gray-200 rounded-2xl">
                    No content sections defined for this page yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sections
                      .filter(s => s.page_id === selectedPageId)
                      .map((sec) => (
                        <div key={sec.id} className="border border-gray-150 rounded-2xl p-5 shadow-3xs flex flex-col sm:flex-row justify-between gap-4 bg-slate-50/20">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-extrabold text-sm text-[#0e2a4d]">{sec.title}</h3>
                              <span className="text-[10px] font-mono text-gray-400 bg-slate-100 px-2 py-0.5 rounded-md">Key: {sec.section_key}</span>
                              <span className="text-[10px] font-bold text-slate-500 inline-flex items-center gap-0.5"><Hash size={10} /> Order {sec.sort_order}</span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium line-clamp-3 whitespace-pre-wrap">{sec.content}</p>
                            <div className="pt-1 select-none">
                              {sec.is_active ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Active</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-red-50 border border-red-100 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Disabled</span>
                              )}
                            </div>
                          </div>
                          <div className="flex sm:flex-col justify-end gap-2 h-fit">
                            {canPages && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditType('section');
                                    setFormData(sec);
                                    setIsEditing(true);
                                  }}
                                  className="p-2 bg-white border border-gray-200 text-slate-500 hover:text-blue-900 rounded-lg cursor-pointer transition-colors shadow-3xs"
                                  title="Edit Section"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteSection(sec.id, sec.title)}
                                  className="p-2 bg-white border border-gray-200 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer transition-colors shadow-3xs"
                                  title="Delete Section"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* FAQs Tab */}
            {activeTab === 'faqs' && (
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-3xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Frequently Asked Questions</h2>
                    <p className="text-xs text-gray-500 mt-1">Configure Q&A help questions to display publicly.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 select-none">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filter Page:</span>
                      <select
                        value={selectedPageId}
                        onChange={(e) => setSelectedPageId(e.target.value)}
                        className="bg-white border border-gray-150 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-900 font-bold text-[#0e2a4d]"
                      >
                        <option value="">-- Global FAQs (Unassigned) --</option>
                        {pages.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>
                    {canFaqs && (
                      <button
                        onClick={() => {
                          setEditType('faq');
                          setFormData({ is_published: true, sort_order: (faqs.filter(f => f.page_id === (selectedPageId || null)).length + 1) * 10 });
                          setIsEditing(true);
                        }}
                        className="bg-[#0e2a4d] hover:bg-[#071c35] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-3xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Add FAQ</span>
                      </button>
                    )}
                  </div>
                </div>

                {faqs.filter(f => f.page_id === (selectedPageId || null)).length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-400 font-bold border border-dashed border-gray-200 rounded-2xl">
                    No FAQs defined for this filter context yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {faqs
                      .filter(f => f.page_id === (selectedPageId || null))
                      .map((faq) => (
                        <div key={faq.id} className="border border-gray-150 rounded-2xl p-5 shadow-3xs flex flex-col sm:flex-row justify-between gap-4 bg-slate-50/20">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-extrabold text-sm text-[#0e2a4d]">{faq.question}</h3>
                              <span className="text-[10px] font-bold text-slate-500 inline-flex items-center gap-0.5"><Hash size={10} /> Order {faq.sort_order}</span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium">{faq.answer}</p>
                            <div className="pt-1 select-none">
                              {faq.is_published ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Published</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-red-50 border border-red-100 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Draft</span>
                              )}
                            </div>
                          </div>
                          <div className="flex sm:flex-col justify-end gap-2 h-fit">
                            {canFaqs && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditType('faq');
                                    setFormData(faq);
                                    setIsEditing(true);
                                  }}
                                  className="p-2 bg-white border border-gray-200 text-slate-500 hover:text-blue-900 rounded-lg cursor-pointer transition-colors shadow-3xs"
                                  title="Edit FAQ"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteFAQ(faq.id)}
                                  className="p-2 bg-white border border-gray-200 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer transition-colors shadow-3xs"
                                  title="Delete FAQ"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Variables Tab */}
            {activeTab === 'variables' && (
              <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-3xs">
                <div className="mb-6">
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Public CMS Variables</h2>
                  <p className="text-xs text-gray-500 mt-1">Configure global text settings substituted dynamically in pages.</p>
                </div>

                {variables.length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-400 font-bold border border-dashed border-gray-200 rounded-2xl">
                    No public CMS variables configured.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {variables.map((v) => (
                      <div key={v.id} className="border border-gray-150 rounded-2xl p-4 sm:p-5 shadow-3xs bg-slate-50/10">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-extrabold text-[#0e2a4d]">{v.variable_key}</span>
                            {v.description && <p className="text-[11px] text-gray-400 font-medium">{v.description}</p>}
                          </div>
                          
                          <div className="w-full sm:w-2/3 flex gap-2">
                            {editingVarId === v.id ? (
                              <>
                                <input
                                  type="text"
                                  value={editingVarValue}
                                  onChange={(e) => setEditingVarValue(e.target.value)}
                                  className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-900 font-medium"
                                />
                                <button
                                  onClick={() => handleSaveVariable(v.id, v.variable_key)}
                                  className="bg-[#0e2a4d] hover:bg-[#071c35] text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-3xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Save size={12} />
                                  <span>Save</span>
                                </button>
                                <button
                                  onClick={() => setEditingVarId('')}
                                  className="border border-gray-250 text-gray-500 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-gray-600 font-mono overflow-x-auto whitespace-nowrap">
                                  {v.value}
                                </span>
                                {canPages && (
                                  <button
                                    onClick={() => {
                                      setEditingVarId(v.id);
                                      setEditingVarValue(v.value);
                                    }}
                                    className="p-1.5 border border-gray-200 hover:border-blue-200 hover:text-blue-900 rounded-lg cursor-pointer transition-colors shadow-3xs bg-white text-slate-500"
                                    title="Edit Variable Value"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

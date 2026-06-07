'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, Filter, RefreshCcw, Calendar, AlertTriangle, ShieldCheck } from 'lucide-react';
import { fetchFilteredAuditLogs } from '@/app/actions/adminAuditActions';

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [actorEmail, setActorEmail] = useState('');
  const [actionKey, setActionKey] = useState('');
  const [targetType, setTargetType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expandable details state
  const [expandedRow, setExpandedRow] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFilteredAuditLogs({
        actorEmail,
        actionKey,
        targetType,
        dateFrom,
        dateTo,
        limit: 100
      });
      if (res.success) {
        setLogs(res.logs || []);
      } else {
        setError(res.error || 'Failed to load audit logs.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [actorEmail, actionKey, targetType, dateFrom, dateTo]);

  useEffect(() => {
    loadLogs();
  }, []);

  const handleApplyFilters = (e) => {
    e.preventDefault();
    loadLogs();
  };

  const handleResetFilters = () => {
    setActorEmail('');
    setActionKey('');
    setTargetType('');
    setDateFrom('');
    setDateTo('');
    // Need a tiny delay for state to settle before reloading, or just load directly with empty args
    setLoading(true);
    fetchFilteredAuditLogs({ limit: 100 }).then(res => {
      if (res.success) setLogs(res.logs || []);
      else setError(res.error || 'Failed to load audit logs.');
      setLoading(false);
    });
  };

  const toggleRow = (id) => {
    if (expandedRow === id) setExpandedRow(null);
    else setExpandedRow(id);
  };

  if (error === 'Permission denied') {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-sm text-gray-500 mt-2">You do not have permission to view platform audit logs.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#0e2a4d] flex items-center gap-2">
            <ShieldCheck size={24} className="text-blue-600" />
            Platform Admin Audit Logs
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Read-only chronological record of all administrative actions.
          </p>
        </div>
        <button 
          onClick={loadLogs}
          disabled={loading}
          className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filter Section */}
      <form onSubmit={handleApplyFilters} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-gray-400" />
          <h3 className="text-sm font-bold text-gray-700">Filter Logs</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Actor Email</label>
            <input 
              type="text" 
              placeholder="user@example.com"
              value={actorEmail}
              onChange={(e) => setActorEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Action Key</label>
            <input 
              type="text" 
              placeholder="e.g. role.assigned"
              value={actionKey}
              onChange={(e) => setActionKey(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Target Type</label>
            <input 
              type="text" 
              placeholder="e.g. role, user"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Date From</label>
            <input 
              type="date" 
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-600"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Date To</label>
            <input 
              type="date" 
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-600"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-50">
          <button 
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Clear Filters
          </button>
          <button 
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-[#0e2a4d] hover:bg-blue-900 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-2"
          >
            <Search size={14} />
            Apply Filters
          </button>
        </div>
      </form>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {error && error !== 'Permission denied' && (
          <div className="p-4 bg-red-50 border-b border-red-100 text-red-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-gray-100">
                <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[140px]">Date/Time</th>
                <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actor Email</th>
                <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Target Type</th>
                <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[120px]">Target ID</th>
                <th className="p-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider min-w-[200px]">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    <Loader2 size={32} className="animate-spin text-blue-900 mx-auto mb-4" />
                    <p className="text-sm font-medium text-gray-400">Fetching secure audit records...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                      <Search size={20} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-bold text-gray-500">No audit logs found.</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const isExpanded = expandedRow === log.id;
                  const dateObj = new Date(log.created_at);
                  const detailsStr = JSON.stringify(log.details);
                  
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 align-top">
                        <div className="text-xs font-bold text-gray-800">{dateObj.toLocaleDateString()}</div>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">{dateObj.toLocaleTimeString()}</div>
                      </td>
                      <td className="p-4 align-top">
                        <span className="text-xs font-medium text-blue-800 bg-blue-50 px-2 py-1 rounded-md">
                          {log.actor_email}
                        </span>
                      </td>
                      <td className="p-4 align-top">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          {log.action_key}
                        </span>
                      </td>
                      <td className="p-4 align-top">
                        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                          {log.target_type || '-'}
                        </span>
                      </td>
                      <td className="p-4 align-top">
                        <span className="text-[10px] font-mono text-gray-400 truncate max-w-[100px] inline-block" title={log.target_id}>
                          {log.target_id ? log.target_id.split('-')[0] + '...' : '-'}
                        </span>
                      </td>
                      <td className="p-4 align-top">
                        {log.details ? (
                          <div>
                            <div className="text-[11px] text-gray-600 font-mono truncate max-w-[200px] mb-1">
                              {detailsStr.substring(0, 40)}{detailsStr.length > 40 ? '...' : ''}
                            </div>
                            <button 
                              onClick={() => toggleRow(log.id)}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
                            >
                              {isExpanded ? 'Hide Payload' : 'View Payload'}
                            </button>
                            {isExpanded && (
                              <div className="mt-2 p-3 bg-gray-900 rounded-lg overflow-x-auto">
                                <pre className="text-[10px] text-green-400 font-mono leading-relaxed m-0">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

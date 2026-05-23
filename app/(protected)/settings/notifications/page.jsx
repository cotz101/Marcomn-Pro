'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { Bell, ShieldCheck, ArrowLeft, Loader2, Users, MessageSquare, Globe } from 'lucide-react';

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { userId, showToast } = useProfile();
  const supabase = createClient();

  const [settings, setSettings] = useState({
    social_enabled: true,
    connection_enabled: true,
    group_enabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;

    async function loadSettings() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSettings({
            social_enabled: data.social_enabled,
            connection_enabled: data.connection_enabled,
            group_enabled: data.group_enabled
          });
        } else {
          // Create default settings if not exists
          const defaultSettings = {
            user_id: userId,
            social_enabled: true,
            connection_enabled: true,
            group_enabled: true
          };
          const { error: insertError } = await supabase
            .from('notification_settings')
            .insert([defaultSettings]);

          if (insertError) throw insertError;
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
        showToast('Error loading notification settings', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [userId, supabase]);

  const handleToggle = async (key) => {
    const originalValue = settings[key];
    const newValue = !originalValue;

    // Optimistic Update
    setSettings(prev => ({ ...prev, [key]: newValue }));

    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: userId,
          ...settings,
          [key]: newValue
        });

      if (error) throw error;
      showToast('Preference saved successfully', 'success');
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast('Failed to save preference', 'error');
      // Rollback
      setSettings(prev => ({ ...prev, [key]: originalValue }));
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: userId,
          ...settings
        });

      if (error) throw error;
      showToast('All settings saved successfully!', 'success');
    } catch (err) {
      console.error('Error saving all settings:', err);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 font-sans">
      
      {/* Back to Profile Nav */}
      <button
        onClick={() => router.push('/profile')}
        className="flex items-center gap-2 text-gray-500 hover:text-navy-900 transition-colors mb-6 text-sm font-semibold cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>Back to Profile</span>
      </button>

      {/* Header card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs mb-6 flex items-start gap-4">
        <div className="p-3 bg-blue-50 rounded-xl text-blue-900 flex items-center justify-center shrink-0">
          <Bell size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#0e2a4d] leading-tight">Notification Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure how and when you receive message alerts, network interactions, and professional updates.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 shadow-xs flex flex-col items-center justify-center space-y-4">
          <Loader2 size={32} className="animate-spin text-blue-900" />
          <span className="text-sm text-gray-500 font-semibold">Loading preferences...</span>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Toggles Card List */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-xs divide-y divide-gray-100 overflow-hidden">
            
            {/* Toggle Item: Social */}
            <div className="p-6 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg shrink-0 mt-0.5">
                  <Globe size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0e2a4d]">Social Notifications</h3>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Receive alerts when connections like, comment, or share your Logbook voyages.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('social_enabled')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.social_enabled ? 'bg-blue-900' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    settings.social_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle Item: Connection */}
            <div className="p-6 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 mt-0.5">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0e2a4d]">Connection Notifications</h3>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Get notified for connection requests, direct messaging handshakes, and acceptances.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('connection_enabled')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.connection_enabled ? 'bg-blue-900' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    settings.connection_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle Item: Group */}
            <div className="p-6 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg shrink-0 mt-0.5">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0e2a4d]">Group & Mentions</h3>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Stay updated on group discussions, mentions, replies, and shared team communication topics.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('group_enabled')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.group_enabled ? 'bg-blue-900' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    settings.group_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

          </div>

          {/* Footer Save Button Card */}
          <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold select-none">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <span>Preferences automatically synced to database</span>
            </div>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-xs transition-all duration-150 disabled:opacity-50 active:scale-[0.98] select-none cursor-pointer flex items-center gap-1.5"
            >
              {saving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : null}
              <span>Save Preferences</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}

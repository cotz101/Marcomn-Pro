'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import { ArrowLeft, Loader2, Image, ShieldAlert, CheckCircle2, ShieldCheck, UploadCloud, RefreshCw } from 'lucide-react';

export default function GlobalSettingsPage() {
  const router = useRouter();
  const { 
    profile, 
    userId, 
    showToast, 
    brandLogoDesktop, 
    brandLogoMobile, 
    refreshGlobalSettings 
  } = useProfile();
  
  const supabase = createClient();
  
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  
  const desktopInputRef = useRef(null);
  const mobileInputRef = useRef(null);

  const isAuthorized = profile && ['super_admin', 'admin', 'brand_manager'].includes(profile.global_role);

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
  const maxFileSize = 2 * 1024 * 1024; // 2MB

  const handleLogoUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    if (!allowedTypes.includes(file.type)) {
      showToast('Unsupported file type. Please upload PNG, JPG, JPEG, SVG, or WEBP.', 'error');
      return;
    }
    if (file.size > maxFileSize) {
      showToast('File is too large. Maximum allowed size is 2MB.', 'error');
      return;
    }

    const setUploading = type === 'desktop' ? setUploadingDesktop : setUploadingMobile;
    setUploading(true);

    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `platform/logos/${type}/brand_logo_${type}.${ext}`;

      // Upload/Upsert to Supabase storage bucket 'platform-assets'
      const { error: uploadError } = await supabase.storage
        .from('platform-assets')
        .upload(path, file, { 
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      // Retrieve public URL
      const { data: { publicUrl } } = supabase.storage
        .from('platform-assets')
        .getPublicUrl(path);

      // Write URL into platform_settings table
      const settingKey = type === 'desktop' ? 'brand_logo_desktop' : 'brand_logo_mobile';
      
      const { error: dbError } = await supabase
        .from('platform_settings')
        .upsert({
          key: settingKey,
          value: publicUrl,
          updated_by: userId,
          updated_at: new Date().toISOString()
        });

      if (dbError) throw dbError;

      await refreshGlobalSettings();
      showToast(`${type === 'desktop' ? 'Desktop' : 'Mobile'} logo updated successfully!`, 'success');
    } catch (err) {
      console.error('Logo upload error:', err);
      showToast(err.message || 'Failed to upload logo', 'error');
    } finally {
      setUploading(false);
      // Reset input element value to allow uploading same file name again
      e.target.value = '';
    }
  };

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-4">
        <Loader2 size={36} className="animate-spin text-blue-900" />
        <span className="text-sm text-gray-500 font-semibold">Validating session permissions...</span>
      </div>
    );
  }

  // Role Access Guard UI
  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center font-sans">
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-md flex flex-col items-center space-y-6">
          <div className="p-4 bg-red-50 text-red-600 rounded-full">
            <ShieldAlert size={48} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-sm text-gray-500 mt-2">
              You do not have the required administrative permissions to access the Global System Settings panel.
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-[#002b4e] hover:bg-[#001c33] text-white text-sm font-bold py-3 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 font-sans">
      
      {/* Navigation and Title */}
      <button
        onClick={() => router.push('/profile')}
        className="flex items-center gap-2 text-gray-500 hover:text-[#002b4e] transition-colors mb-6 text-sm font-bold cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>Back to Profile</span>
      </button>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-6 flex items-start gap-4">
        <div className="p-3 bg-blue-50 text-blue-950 rounded-xl flex items-center justify-center shrink-0">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#0e2a4d] leading-tight">Global System Settings</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Manage administrative platform configuration, system branding preferences, and global logo assets.
          </p>
        </div>
      </div>

      {/* Main Settings Panel */}
      <div className="space-y-6">
        
        {/* Section: Branding Settings */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden p-6">
          <div className="border-b border-gray-100 pb-4 mb-6">
            <h2 className="text-base font-bold text-[#0e2a4d]">Branding Settings</h2>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Configure and upload the primary system logos used across the desktop, tablet, and mobile platforms.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Desktop / Tablet Logo */}
            <div className="flex flex-col space-y-4">
              <label className="text-sm font-bold text-gray-700">Desktop / Tablet Logo</label>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                Used in the main desktop navigation bar and wider tablet layouts.
              </p>
              
              {/* Logo Preview Box */}
              <div className="border border-dashed border-gray-200 rounded-xl h-40 flex flex-col items-center justify-center bg-gray-50/50 p-4 relative overflow-hidden">
                {brandLogoDesktop ? (
                  <img 
                    src={brandLogoDesktop} 
                    alt="Desktop Logo Preview" 
                    className="max-h-24 max-w-full object-contain" 
                  />
                ) : (
                  <div className="flex flex-col items-center text-gray-400 space-y-2">
                    <Image size={32} />
                    <span className="text-xs font-semibold">Using default text/anchor fallback</span>
                  </div>
                )}
                {uploadingDesktop && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center space-x-2">
                    <Loader2 size={20} className="animate-spin text-blue-900" />
                    <span className="text-xs text-gray-500 font-bold">Uploading...</span>
                  </div>
                )}
              </div>

              {/* Upload Action */}
              <button
                onClick={() => desktopInputRef.current?.click()}
                disabled={uploadingDesktop}
                className="w-full border-2 border-dashed border-gray-200 hover:border-blue-900 hover:bg-blue-50/20 text-[#002b4e] font-bold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
              >
                <UploadCloud size={16} />
                <span>Upload Desktop Logo</span>
              </button>
              <input 
                type="file" 
                ref={desktopInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                onChange={(e) => handleLogoUpload(e, 'desktop')}
              />
            </div>

            {/* Mobile Logo */}
            <div className="flex flex-col space-y-4">
              <label className="text-sm font-bold text-gray-700">Mobile Logo</label>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                Used in the compact mobile top bar navigation layout.
              </p>

              {/* Logo Preview Box */}
              <div className="border border-dashed border-gray-200 rounded-xl h-40 flex flex-col items-center justify-center bg-gray-50/50 p-4 relative overflow-hidden">
                {brandLogoMobile ? (
                  <img 
                    src={brandLogoMobile} 
                    alt="Mobile Logo Preview" 
                    className="max-h-24 max-w-full object-contain" 
                  />
                ) : (
                  <div className="flex flex-col items-center text-gray-400 space-y-2">
                    <Image size={32} />
                    <span className="text-xs font-semibold">Using default text/anchor fallback</span>
                  </div>
                )}
                {uploadingMobile && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center space-x-2">
                    <Loader2 size={20} className="animate-spin text-blue-900" />
                    <span className="text-xs text-gray-500 font-bold">Uploading...</span>
                  </div>
                )}
              </div>

              {/* Upload Action */}
              <button
                onClick={() => mobileInputRef.current?.click()}
                disabled={uploadingMobile}
                className="w-full border-2 border-dashed border-gray-200 hover:border-blue-900 hover:bg-blue-50/20 text-[#002b4e] font-bold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
              >
                <UploadCloud size={16} />
                <span>Upload Mobile Logo</span>
              </button>
              <input 
                type="file" 
                ref={mobileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                onChange={(e) => handleLogoUpload(e, 'mobile')}
              />
            </div>

          </div>
        </div>

        {/* Footer info card */}
        <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold select-none">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>Updates are live and apply globally to the headers</span>
          </div>
          <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
            Phase 1 Branding settings
          </div>
        </div>

      </div>
    </div>
  );
}

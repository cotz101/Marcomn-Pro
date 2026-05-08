'use client';

export default function ProfessionalCardSkeleton() {
  return (
    <div className="professional-card card">
      {/* Avatar Zone (Left) */}
      <div className="card-avatar-wrapper">
        <div className="skeleton skeleton-avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }}></div>
      </div>

      {/* Info Zone (Right) */}
      <div className="professional-info-container">
        <div className="hiring-status mb-2">
          <div className="skeleton skeleton-text" style={{ width: '40%', height: '12px' }}></div>
        </div>

        <div className="skeleton skeleton-text skeleton-title" style={{ width: '80%', height: '16px', marginBottom: '8px' }}></div>
        <div className="skeleton skeleton-text skeleton-subtitle" style={{ width: '60%', height: '14px', marginBottom: '12px' }}></div>
        
        <div className="skeleton skeleton-text" style={{ width: '50%', height: '12px', marginBottom: '16px' }}></div>

        <div className="professional-actions pt-2" style={{ width: '100%' }}>
          <div className="skeleton skeleton-btn" style={{ width: '100%', height: '32px', marginBottom: '8px' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '40%', height: '12px', margin: '0 auto' }}></div>
        </div>
      </div>
    </div>
  );
}

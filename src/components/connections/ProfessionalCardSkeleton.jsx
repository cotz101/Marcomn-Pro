'use client';

export default function ProfessionalCardSkeleton() {
  return (
    <div className="professional-card card w-full">
      <div className="card-avatar-wrapper">
        <div className="skeleton skeleton-avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }}></div>
      </div>

      <div className="professional-info-container">
        <div className="skeleton skeleton-text" style={{ width: '60%', height: '14px', marginBottom: '8px' }}></div>
        <div className="skeleton skeleton-text" style={{ width: '40%', height: '12px', marginBottom: '12px' }}></div>
        
        <div className="skeleton skeleton-text" style={{ width: '80%', height: '30px', marginBottom: '16px' }}></div>

        <div className="professional-actions" style={{ width: '100%' }}>
          <div className="skeleton skeleton-btn" style={{ width: '100%', height: '32px', marginBottom: '4px' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '30%', height: '10px', margin: '0 auto' }}></div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';

export default function ConnectionsHub() {
  const [activeTab, setActiveTab] = useState('mutual');

  return (
    <div>
      <div className="tabs-header">
        <button 
          className={`tab-btn ${activeTab === 'mutual' ? 'active' : ''}`}
          onClick={() => setActiveTab('mutual')}
        >
          Mutual Connections
        </button>
        <button 
          className={`tab-btn ${activeTab === 'following' ? 'active' : ''}`}
          onClick={() => setActiveTab('following')}
        >
          Following
        </button>
      </div>

      <div className="tabs-content" style={{ minHeight: '300px' }}>
        {activeTab === 'mutual' ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px' }}>You have 45 mutual connections.</p>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px' }}>You are following 12 entities.</p>
        )}
      </div>
    </div>
  );
}

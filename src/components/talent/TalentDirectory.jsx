import { Search } from 'lucide-react';

export default function TalentDirectory() {
  const talents = [
    { id: 1, name: 'Alice Walker', headline: 'Chief Officer at SeaWays', location: 'London, UK', avatar: '/profile_pic.png' },
    { id: 2, name: 'David Chen', headline: 'Marine Electrician', location: 'Singapore', avatar: '/profile_pic.png' },
    { id: 3, name: 'Sarah Miller', headline: 'Logistics Coordinator', location: 'Rotterdam, NL', avatar: '/profile_pic.png' }
  ];

  return (
    <div>
      <div className="card" style={{ padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Search size={20} color="var(--text-secondary)" />
        <input 
          type="text" 
          placeholder="Search for talent by name, skill, or title..." 
          style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '16px', color: 'var(--text-primary)' }} 
        />
      </div>

      <div className="talent-grid">
        {talents.map(talent => (
          <div key={talent.id} className="card group-card">
            <img src={talent.avatar} alt={talent.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <div className="group-name">{talent.name}</div>
              <div className="group-members">{talent.headline}</div>
              <div className="group-members" style={{ marginTop: '4px' }}>{talent.location}</div>
            </div>
            <button className="btn-secondary" style={{ width: '100%', marginTop: 'auto' }}>Connect</button>
          </div>
        ))}
      </div>
    </div>
  );
}

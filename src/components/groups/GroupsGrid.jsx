import { useState } from 'react';
import { Users, Ship, Compass, Anchor } from 'lucide-react';

export default function GroupsGrid() {
  const initialGroups = [
    { id: 1, name: 'Marine Engineers Network', members: '12,045', joined: false, icon: <Anchor size={40} /> },
    { id: 2, name: 'Global Master Mariners', members: '8,320', joined: true, icon: <Ship size={40} /> },
    { id: 3, name: 'Maritime Logistics Experts', members: '5,112', joined: false, icon: <Compass size={40} /> },
    { id: 4, name: 'Offshore Wind Professionals', members: '3,490', joined: false, icon: <Users size={40} /> }
  ];

  const [groups, setGroups] = useState(initialGroups);

  const toggleJoin = (id) => {
    setGroups(groups.map(g => g.id === id ? { ...g, joined: !g.joined } : g));
  };

  return (
    <div className="groups-grid">
      {groups.map(group => (
        <div key={group.id} className="card group-card">
          <div className="group-icon">{group.icon}</div>
          <div>
            <div className="group-name">{group.name}</div>
            <div className="group-members">{group.members} members</div>
          </div>
          <button 
            className={group.joined ? "btn-secondary" : "btn-primary"}
            onClick={() => toggleJoin(group.id)}
            style={{ width: '100%', marginTop: 'auto' }}
          >
            {group.joined ? 'Member' : 'Join'}
          </button>
        </div>
      ))}
    </div>
  );
}

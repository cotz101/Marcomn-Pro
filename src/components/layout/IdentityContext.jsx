import { createContext, useContext, useState, useEffect } from 'react';

const IdentityContext = createContext();

export const useIdentity = () => {
  const context = useContext(IdentityContext);
  if (!context) {
    throw new Error('useIdentity must be used within an IdentityProvider');
  }
  return context;
};

const PERSONAL_IDENTITY = {
  id: 'personal',
  type: 'personal',
  name: 'Efren Jr Vergara',
  role: 'Personal',
  avatar: '/profile_pic.png'
};

const COMPANY_IDENTITY = {
  id: 'company',
  type: 'company',
  name: 'MarComn HQ',
  role: 'Corporate',
  avatar: '/company_logo.png' // Make sure this exists or use a default
};

export const IdentityProvider = ({ children }) => {
  const [activeIdentity, setActiveIdentity] = useState(() => {
    const saved = localStorage.getItem('activeIdentity');
    return saved ? JSON.parse(saved) : PERSONAL_IDENTITY;
  });

  const [identities, setIdentities] = useState([PERSONAL_IDENTITY, COMPANY_IDENTITY]);

  useEffect(() => {
    localStorage.setItem('activeIdentity', JSON.stringify(activeIdentity));
  }, [activeIdentity]);

  const switchIdentity = (identityId) => {
    const identity = identities.find(id => id.id === identityId);
    if (identity) {
      setActiveIdentity(identity);
    }
  };

  const signOut = () => {
    // Implement sign out logic here
    console.log('Signing out...');
  };

  return (
    <IdentityContext.Provider value={{ activeIdentity, identities, switchIdentity, signOut }}>
      {children}
    </IdentityContext.Provider>
  );
};

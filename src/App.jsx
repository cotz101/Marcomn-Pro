import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/layout/Header'
import LogbookFeed from './components/logbook/LogbookFeed'
import GroupsGrid from './components/groups/GroupsGrid'
import TalentDirectory from './components/talent/TalentDirectory'
import ConnectionsHub from './components/connections/ConnectionsHub'
import Profile from './components/profile/Profile'

const DEFAULT_PROFILE = {
  fullName: 'Efren jr',
  headline: 'IT Specialist',
  about: 'Passionate IT Specialist with expertise in network infrastructure, system administration, and technical support. Dedicated to optimizing IT operations and ensuring seamless technology experiences. Always eager to learn new technologies and solve complex technical challenges.',
  location: 'Global • Open to work',
  profilePic: '/profile_pic.png',
  coverPhoto: '/cover_photo.png'
}

function App() {
  const [darkMode, setDarkMode] = useState(false)
  
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('profileData');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem('profileData', JSON.stringify(profile))
  }, [profile])

  return (
    <BrowserRouter>
      <Header />
      <main className="app-layout">
        <Routes>
          <Route path="/" element={<LogbookFeed profile={profile} />} />
          <Route path="/groups" element={<GroupsGrid />} />
          <Route path="/talent" element={<TalentDirectory />} />
          <Route path="/connections" element={<ConnectionsHub />} />
          <Route path="/profile" element={<Profile profile={profile} setProfile={setProfile} />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App

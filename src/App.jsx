import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/layout/Header'
import SidebarLeft from './components/layout/SidebarLeft'
import SidebarRight from './components/layout/SidebarRight'
import LogbookFeed from './components/logbook/LogbookFeed'
import GroupsDirectory from './components/groups/GroupsDirectory'
import TalentDirectory from './components/talent/TalentDirectory'
import ConnectionsHub from './components/connections/ConnectionsHub'
import Profile from './components/profile/Profile'
import ServicesFeed from './components/services/ServicesFeed'
import BlogFeed from './components/blog/BlogFeed'
import MobileShell from './components/layout/MobileShell'

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
        <div className="max-w-[1128px] mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[225px_1fr_300px] gap-6 px-4 md:px-0">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block">
              <SidebarLeft />
            </div>

            {/* Main Feed */}
            <div className="min-w-0">
              <Routes>
                <Route path="/" element={<LogbookFeed profile={profile} />} />
                <Route path="/groups" element={<GroupsDirectory />} />
                <Route path="/talent" element={<TalentDirectory />} />
                <Route path="/connections" element={<ConnectionsHub />} />
                <Route path="/services" element={<ServicesFeed />} />
                <Route path="/blog" element={<BlogFeed />} />
                <Route path="/profile/:id?" element={<Profile profile={profile} setProfile={setProfile} />} />
              </Routes>
            </div>

            {/* Right Sidebar - Hidden on mobile */}
            <div className="hidden lg:block">
              <SidebarRight />
            </div>
          </div>
        </div>
      </main>
      <MobileShell />
    </BrowserRouter>
  )
}

export default App

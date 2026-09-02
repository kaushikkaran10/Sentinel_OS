import React, { useState, useEffect } from 'react'
import './styles/design-system.css'
import TopNavbar from './components/TopNavbar'
import HeroSection from './components/HeroSection'
import ShowcaseSection from './components/ShowcaseSection'
import HowItWorksSection from './components/HowItWorksSection'
import FeaturesBentoGrid from './components/FeaturesBentoGrid'
import FooterSection from './components/FooterSection'
import WorkbenchStudio from './components/WorkbenchStudio'
import { fetchTelemetry, fetchModels } from './services/api'

export default function App() {
  const [viewMode, setViewMode] = useState(() => {
    const path = window.location.pathname.toLowerCase()
    const params = new URLSearchParams(window.location.search)
    return path.includes('/workbench') || params.get('view') === 'workbench' ? 'workbench' : 'workbench' // Default to workbench directly!
  })

  const [activeTab, setActiveTab] = useState('workspace')
  const [telemetry, setTelemetry] = useState(null)
  const [models, setModels] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sentinel-theme') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sentinel-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const loadStatus = async () => {
    setIsRefreshing(true)
    try {
      const [tData, mData] = await Promise.all([
        fetchTelemetry().catch(() => null),
        fetchModels().catch(() => null),
      ])
      if (tData) setTelemetry(tData)
      if (mData) setModels(mData)
    } catch (err) {
      console.error('Status poll error:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 15000)

    const handleMouseMove = (e) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`)
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true })

    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase()
      const params = new URLSearchParams(window.location.search)
      const isWb = path.includes('/workbench') || params.get('view') === 'workbench'
      setViewMode(isWb ? 'workbench' : 'portal')
    }
    window.addEventListener('popstate', handlePopState)

    return () => {
      clearInterval(interval)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    window.history.pushState({}, '', mode === 'workbench' ? '/workbench' : '/')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const launchWorkbench = (tabId = 'workspace') => {
    setActiveTab(tabId)
    handleViewModeChange('workbench')
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Global Modern Top Navbar */}
      <TopNavbar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        telemetry={telemetry}
        models={models}
        onRefresh={loadStatus}
        isRefreshing={isRefreshing}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      {viewMode === 'workbench' ? (
        <WorkbenchStudio
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onReturnToPortal={() => handleViewModeChange('portal')}
          telemetry={telemetry}
          models={models}
          onRefresh={loadStatus}
          isRefreshing={isRefreshing}
        />
      ) : (
        <main style={{ flex: 1 }}>
          <HeroSection
            onLaunchWorkbench={() => launchWorkbench('workspace')}
            onScrollToSection={(sectionId) => {
              const el = document.getElementById(sectionId)
              if (el) el.scrollIntoView({ behavior: 'smooth' })
            }}
            telemetry={telemetry}
            activeModel={models?.active_models?.[0] || 'llama3.1:8b'}
          />

          <ShowcaseSection
            onJumpToConsole={() => launchWorkbench('workspace')}
          />

          <HowItWorksSection
            onJumpToConsole={() => launchWorkbench('workspace')}
          />

          <FeaturesBentoGrid />

          <FooterSection
            onJumpToTop={scrollToTop}
            onJumpToConsole={() => launchWorkbench('workspace')}
          />
        </main>
      )}
    </div>
  )
}

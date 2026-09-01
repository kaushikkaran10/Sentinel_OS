import React, { useState, useEffect } from 'react'
import './styles/design-system.css'
import NavigationRail from './components/NavigationRail'
import HeroSection from './components/HeroSection'
import ShowcaseSection from './components/ShowcaseSection'
import HowItWorksSection from './components/HowItWorksSection'
import FeaturesBentoGrid from './components/FeaturesBentoGrid'
import FooterSection from './components/FooterSection'
import WorkbenchStudio from './components/WorkbenchStudio'
import RetroBootSequence from './components/RetroBootSequence'
import { fetchTelemetry, fetchModels } from './services/api'

export default function App() {
  const [viewMode, setViewMode] = useState(() => {
    const path = window.location.pathname.toLowerCase()
    const params = new URLSearchParams(window.location.search)
    return path.includes('/workbench') || params.get('view') === 'workbench' ? 'workbench' : 'portal'
  })
  const [isBooting, setIsBooting] = useState(false)
  const [activeTab, setActiveTab] = useState('workspace')
  const [telemetry, setTelemetry] = useState(null)
  const [models, setModels] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  const launchWorkbench = (tabId = 'workspace', showBoot = true) => {
    setActiveTab(tabId)
    if (showBoot) {
      setIsBooting(true)
    } else {
      setViewMode('workbench')
      window.history.pushState({}, '', '/workbench')
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }

  const handleBootComplete = () => {
    setIsBooting(false)
    setViewMode('workbench')
    window.history.pushState({}, '', '/workbench')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const returnToPortal = () => {
    setViewMode('portal')
    window.history.pushState({}, '', '/')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeModelTag = models?.active_models?.[0] || 'llama3.1:8b'

  // If in Workbench Studio Mode
  if (viewMode === 'workbench') {
    return (
      <>
        {isBooting && (
          <RetroBootSequence
            onComplete={handleBootComplete}
            activeModel={activeModelTag}
          />
        )}
        <WorkbenchStudio
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onReturnToPortal={returnToPortal}
          telemetry={telemetry}
          models={models}
          onRefresh={loadStatus}
          isRefreshing={isRefreshing}
        />
      </>
    )
  }

  // Showcase & Landing Portal Mode
  return (
    <div className="app-container">
      {isBooting && (
        <RetroBootSequence
          onComplete={handleBootComplete}
          activeModel={activeModelTag}
        />
      )}

      {/* Left Navigation Rail */}
      <NavigationRail
        activeTab={activeTab}
        onTabChange={(tabId) => launchWorkbench(tabId, true)}
        telemetry={telemetry}
        inStudioMode={false}
      />

      {/* Main Center Stage */}
      <main className="main-stage">
        {/* 1. Hero Section with WebGL / Canvas Hologram Mascot */}
        <HeroSection
          onLaunchWorkbench={() => launchWorkbench('workspace', true)}
          onScrollToSection={(sectionId) => {
            const el = document.getElementById(sectionId)
            if (el) el.scrollIntoView({ behavior: 'smooth' })
          }}
          telemetry={telemetry}
          activeModel={activeModelTag}
        />

        {/* 2. Interactive Product Showcase Tabs */}
        <ShowcaseSection
          onJumpToConsole={() => launchWorkbench('workspace', true)}
        />

        {/* 3. "How It Works" 4-Step Interactive Timeline */}
        <HowItWorksSection
          onJumpToConsole={() => launchWorkbench('workspace', true)}
        />

        {/* 4. Bento Grid Core Capabilities */}
        <FeaturesBentoGrid />

        {/* 5. Footer Section */}
        <FooterSection
          onJumpToTop={scrollToTop}
          onJumpToConsole={() => launchWorkbench('workspace', true)}
        />
      </main>
    </div>
  )
}

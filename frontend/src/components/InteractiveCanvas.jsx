import React, { useEffect, useRef } from 'react'
import mascotDots from '../data/mascotDots.json'

/**
 * InteractiveCanvas — Pixel-Perfect AgentForge Halftone Robot Mascot
 * Renders the 2,477 outlined circular ring dots matching the reference design,
 * with real-time cursor repulsion physics, elastic spring-back, and ambient undulation.
 */
export default function InteractiveCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId

    // Handle high DPI displays for ultra-crisp ring rendering
    const dpr = window.devicePixelRatio || 1
    let displayWidth = canvas.offsetWidth
    let displayHeight = canvas.offsetHeight
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    ctx.scale(dpr, dpr)

    // Mouse coordinates with smooth easing
    const mouse = {
      x: -9999,
      y: -9999,
      targetX: -9999,
      targetY: -9999,
      radius: 95,
      isHovering: false,
    }

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouse.targetX = e.clientX - rect.left
      mouse.targetY = e.clientY - rect.top
      mouse.isHovering = true
    }

    const handleMouseLeave = () => {
      mouse.targetX = -9999
      mouse.targetY = -9999
      mouse.isHovering = false
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    let particles = []

    const initParticles = () => {
      displayWidth = canvas.offsetWidth
      displayHeight = canvas.offsetHeight
      canvas.width = displayWidth * dpr
      canvas.height = displayHeight * dpr
      ctx.scale(dpr, dpr)

      const cx = displayWidth * 0.5
      const cy = displayHeight * 0.5

      // Aspect ratio of the original mascot is 578:334 (~1.73)
      const scaleX = Math.min(displayWidth * 0.94, (displayHeight * 0.92) * (578 / 334)) * 0.5
      const scaleY = (scaleX / 578) * 334

      particles = mascotDots.map(([nx, ny]) => {
        const ox = cx + nx * scaleX
        const oy = cy + ny * scaleY
        return {
          ox,
          oy,
          x: ox,
          y: oy,
          vx: 0,
          vy: 0,
          nx,
          ny,
          // Detect if dot is an eye cluster (near nx around -0.15 or +0.15, ny around 0.1)
          isEye: Math.abs(ny - 0.12) < 0.12 && (Math.abs(nx + 0.15) < 0.1 || Math.abs(nx - 0.17) < 0.1),
        }
      })
    }

    initParticles()

    const handleResize = () => {
      initParticles()
    }
    window.addEventListener('resize', handleResize)

    let time = 0

    const render = () => {
      time += 0.025

      // Smooth mouse interpolation
      if (mouse.isHovering) {
        mouse.x += (mouse.targetX - mouse.x) * 0.14
        mouse.y += (mouse.targetY - mouse.y) * 0.14
      } else {
        mouse.x = -9999
        mouse.y = -9999
      }

      ctx.clearRect(0, 0, displayWidth, displayHeight)

      // Render all 2,477 outlined ring dots
      const len = particles.length
      for (let i = 0; i < len; i++) {
        const p = particles[i]

        // Ambient breathing wave
        const waveY = Math.sin(time + p.nx * 3.5 + p.ny * 2.0) * 1.6
        const waveX = Math.cos(time * 0.8 + p.ny * 3.0) * 0.8

        const targetX = p.ox + waveX
        const targetY = p.oy + waveY

        // Mouse physics interaction (repulsion)
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        let proximityAlpha = 0
        if (dist < mouse.radius && mouse.isHovering) {
          const force = (mouse.radius - dist) / mouse.radius
          const angle = Math.atan2(dy, dx)
          p.vx -= Math.cos(angle) * force * 4.5
          p.vy -= Math.sin(angle) * force * 4.5
          proximityAlpha = force
        }

        // Spring force returning to target position
        p.vx += (targetX - p.x) * 0.1
        p.vy += (targetY - p.y) * 0.1

        // Friction damping
        p.vx *= 0.8
        p.vy *= 0.8

        p.x += p.vx
        p.y += p.vy

        // Draw outlined circular ring (matching the exact reference image)
        ctx.beginPath()
        const ringRadius = 1.9 + proximityAlpha * 0.6
        ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2)

        if (proximityAlpha > 0.3) {
          // Highlight near cursor
          ctx.strokeStyle = proximityAlpha > 0.6 ? '#df533f' : '#3d372f'
          ctx.lineWidth = 1.2
        } else {
          // Exact warm taupe/sepia outline from inspiration image
          ctx.strokeStyle = '#a49887'
          ctx.lineWidth = 1.0
        }
        ctx.stroke()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '380px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'crosshair',
        }}
      />
      {/* Monospace Interactive Indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '16px',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--ink-muted)',
          letterSpacing: '0.05em',
          pointerEvents: 'none',
          background: 'rgba(243, 237, 226, 0.75)',
          padding: '2px 8px',
          borderRadius: '4px',
          border: '1px dashed var(--border-subtle)',
        }}
      >
        [INTERACTIVE MASCOT • HOVER TO RIPPLE]
      </div>
    </div>
  )
}

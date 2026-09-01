/**
 * Sentinel OS — Frontend API Client
 * Interfaces with FastAPI endpoints at /api/v1/ and /health
 */

const API_BASE = '/api/v1'

export async function checkHealth() {
  const res = await fetch('/health')
  if (!res.ok) throw new Error(`Health check failed (${res.status})`)
  return res.json()
}

export async function fetchTelemetry() {
  const res = await fetch(`${API_BASE}/system/telemetry`)
  if (!res.ok) throw new Error(`Telemetry failed (${res.status})`)
  return res.json()
}

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/system/models`)
  if (!res.ok) throw new Error(`Models query failed (${res.status})`)
  return res.json()
}

export async function fetchHistory() {
  const res = await fetch(`${API_BASE}/workspace/history`)
  if (!res.ok) throw new Error(`History fetch failed (${res.status})`)
  return res.json()
}

export async function submitTask(prompt, file = null) {
  const formData = new FormData()
  formData.append('prompt', prompt)
  if (file) {
    formData.append('file', file)
  }

  const res = await fetch(`${API_BASE}/workspace/task`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to submit task' }))
    const msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)
    throw new Error(msg)
  }

  return res.json()
}

/**
 * Consumes Server-Sent Events (SSE) from /api/v1/workspace/stream/{taskId}
 */
export async function streamTaskEvents(taskId, { onEvent, onError, onComplete }) {
  try {
    const res = await fetch(`${API_BASE}/workspace/stream/${taskId}`)
    if (!res.ok) {
      throw new Error(`SSE stream connection failed with status ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let curEvent = ''
    let curData = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() // keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('event:')) {
          curEvent = trimmed.slice(6).trim()
        } else if (trimmed.startsWith('data:')) {
          try {
            curData = JSON.parse(trimmed.slice(5).trim())
          } catch {
            curData = trimmed.slice(5).trim()
          }
        } else if (trimmed === '' && curEvent) {
          // Completed frame
          const frame = { event: curEvent, data: curData }
          onEvent(frame)
          if (curEvent === 'complete') {
            if (onComplete) onComplete(curData)
            return
          }
          curEvent = ''
          curData = null
        }
      }
    }
  } catch (err) {
    if (onError) onError(err)
  }
}

export function getDownloadUrl(fileId) {
  return `${API_BASE}/workspace/download/${encodeURIComponent(fileId)}`
}

export async function uploadKbDocument(file, category = 'SOP') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('category', category)

  const res = await fetch(`${API_BASE}/kb/documents`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to upload KB document' }))
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail))
  }

  return res.json()
}

export async function purgeData() {
  const res = await fetch(`${API_BASE}/system/purge`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Purge failed')
  return res.json()
}

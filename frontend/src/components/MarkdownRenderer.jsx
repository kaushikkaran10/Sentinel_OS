import React from 'react'

/**
 * Lightweight, robust Markdown Renderer tailored for industrial engineering briefs.
 * Handles headings, bold/italic, bullet lists, blockquotes, code blocks,
 * and rich GFM-style tables with status pill badges.
 */
export default function MarkdownRenderer({ content }) {
  if (!content) return null

  // Helper to render inline formatting (bold, italic, code, status pill)
  const renderInline = (text) => {
    if (!text) return ''

    // Split on inline patterns: **bold**, `code`, *italic*
    const parts = []
    let cursor = 0
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > cursor) {
        parts.push(text.substring(cursor, match.index))
      }
      const token = match[0]
      if (token.startsWith('**') && token.endsWith('**')) {
        const inner = token.slice(2, -2)
        // Check for status keywords
        if (inner === 'HIGH') {
          parts.push(<span key={cursor} className="status-pill danger">HIGH</span>)
        } else if (inner === 'Within Tolerance') {
          parts.push(<span key={cursor} className="status-pill success">Within Tolerance</span>)
        } else if (inner === 'pending_human_review') {
          parts.push(<span key={cursor} className="status-pill warning">pending_human_review</span>)
        } else {
          parts.push(<strong key={cursor}>{inner}</strong>)
        }
      } else if (token.startsWith('`') && token.endsWith('`')) {
        const inner = token.slice(1, -1)
        if (inner === 'pending_human_review') {
          parts.push(<span key={cursor} className="status-pill warning">pending_human_review</span>)
        } else {
          parts.push(<code key={cursor}>{inner}</code>)
        }
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(<em key={cursor}>{token.slice(1, -1)}</em>)
      }
      cursor = regex.lastIndex
    }

    if (cursor < text.length) {
      parts.push(text.substring(cursor))
    }

    return parts
  }

  // Parse lines into block structures
  const lines = content.split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    // Horizontal Rule
    if (/^---$|^\*\*\*$/.test(trimmed)) {
      blocks.push({ type: 'hr', key: i })
      i++
      continue
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      blocks.push({ type: 'h4', text: trimmed.slice(5), key: i })
      i++
      continue
    }
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4), key: i })
      i++
      continue
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3), key: i })
      i++
      continue
    }
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: trimmed.slice(2), key: i })
      i++
      continue
    }

    // Blockquote / Warning Callout
    if (trimmed.startsWith('>')) {
      const bqText = trimmed.replace(/^>\s*/, '')
      blocks.push({
        type: 'blockquote',
        text: bqText,
        isWarning: /warning|caution|alert|does not authorize/i.test(bqText),
        key: i,
      })
      i++
      continue
    }

    // Markdown Table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim())

        // Skip separator line (tableLines[1])
        const rowLines = tableLines.slice(2)
        const rows = rowLines.map((r) =>
          r
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        )

        blocks.push({
          type: 'table',
          headers: headerCells,
          rows: rows,
          key: `tbl-${i}`,
        })
        continue
      }
    }

    // Bullet list items
    if (/^[-*•]\s+/.test(trimmed)) {
      const listItems = []
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[-*•]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items: listItems, key: `ul-${i}` })
      continue
    }

    // Paragraph
    blocks.push({ type: 'p', text: trimmed, key: i })
    i++
  }

  return (
    <div className="markdown-doc">
      {blocks.map((block) => {
        switch (block.type) {
          case 'h1':
            return <h1 key={block.key}>{renderInline(block.text)}</h1>
          case 'h2':
            return <h2 key={block.key}>{renderInline(block.text)}</h2>
          case 'h3':
            return <h3 key={block.key}>{renderInline(block.text)}</h3>
          case 'h4':
            return <h4 key={block.key}>{renderInline(block.text)}</h4>
          case 'hr':
            return <hr key={block.key} />
          case 'blockquote':
            return (
              <div
                key={block.key}
                className={`doc-blockquote ${block.isWarning ? 'warning' : ''}`}
              >
                {renderInline(block.text)}
              </div>
            )
          case 'ul':
            return (
              <ul key={block.key}>
                {block.items.map((item, idx) => (
                  <li key={idx}>{renderInline(item)}</li>
                ))}
              </ul>
            )
          case 'table':
            return (
              <div key={block.key} className="doc-table-container">
                <table className="doc-table">
                  <thead>
                    <tr>
                      {block.headers.map((h, idx) => (
                        <th key={idx}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((r, rIdx) => (
                      <tr key={rIdx}>
                        {r.map((cell, cIdx) => {
                          const isNumber = /^[-+]?[\d,.]+%?$/.test(cell)
                          let cellPill = null
                          if (cell === 'HIGH') cellPill = <span className="status-pill danger">HIGH</span>
                          if (cell === 'Within Tolerance') cellPill = <span className="status-pill success">Within Tolerance</span>
                          if (cell === 'pending_human_review') cellPill = <span className="status-pill warning">pending_human_review</span>
                          if (cell === 'Unaccounted Loss') cellPill = <span className="status-pill info">Unaccounted Loss</span>

                          return (
                            <td
                              key={cIdx}
                              style={{ textAlign: isNumber ? 'right' : 'left' }}
                            >
                              {cellPill || renderInline(cell)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'p':
            return <p key={block.key}>{renderInline(block.text)}</p>
          default:
            return null
        }
      })}
    </div>
  )
}

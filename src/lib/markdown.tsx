import { Fragment, type ReactNode } from 'react'

// Minimal markdown → React. Soporta: H1-H4, listas, citas, negrita, cursiva,
// código inline, bloques ```, links, párrafos. Sin HTML crudo → safe.

type Block =
  | { type: 'h'; level: number; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; lang: string; content: string }
  | { type: 'hr' }

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++ }
      i++
      out.push({ type: 'code', lang, content: buf.join('\n') })
      continue
    }
    if (/^\s*$/.test(line)) { i++; continue }
    if (/^---+\s*$/.test(line)) { out.push({ type: 'hr' }); i++; continue }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) { out.push({ type: 'h', level: h[1].length, text: h[2] }); i++; continue }
    if (line.startsWith('> ')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) { buf.push(lines[i].slice(2)); i++ }
      out.push({ type: 'quote', text: buf.join(' ') })
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      out.push({ type: 'ul', items })
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      out.push({ type: 'ol', items })
      continue
    }
    const buf: string[] = [line]
    i++
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4})\s+/.test(lines[i])
      && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])
      && !lines[i].startsWith('```') && !lines[i].startsWith('> ')) {
      buf.push(lines[i]); i++
    }
    out.push({ type: 'p', text: buf.join(' ') })
  }
  return out
}

function renderInline(text: string): ReactNode[] {
  // Patrones: `code`, **bold**, *italic*, [txt](url)
  const nodes: ReactNode[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0; let m: RegExpExecArray | null; let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>)
    const tok = m[0]
    if (tok.startsWith('`')) {
      nodes.push(<code key={key++} className="px-1 py-0.5 rounded bg-[var(--secondary)] font-mono text-[0.9em]">{tok.slice(1, -1)}</code>)
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={key++}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('*')) {
      nodes.push(<em key={key++}>{tok.slice(1, -1)}</em>)
    } else if (tok.startsWith('[')) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!
      nodes.push(<a key={key++} href={mm[2]} target="_blank" rel="noreferrer" className="underline text-[var(--primary)]">{mm[1]}</a>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>)
  return nodes
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source)
  return (
    <div className={className ?? 'prose-sm text-sm leading-relaxed space-y-2'}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h': {
            const sz = b.level === 1 ? 'text-xl font-bold' : b.level === 2 ? 'text-lg font-semibold' : b.level === 3 ? 'text-base font-semibold' : 'text-sm font-semibold'
            return <div key={i} className={`${sz} mt-3 mb-1`}>{renderInline(b.text)}</div>
          }
          case 'p': return <p key={i}>{renderInline(b.text)}</p>
          case 'ul': return <ul key={i} className="list-disc pl-5 space-y-0.5">{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>
          case 'ol': return <ol key={i} className="list-decimal pl-5 space-y-0.5">{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ol>
          case 'quote': return <blockquote key={i} className="border-l-2 border-[var(--primary)] pl-3 italic text-[var(--muted-foreground)]">{renderInline(b.text)}</blockquote>
          case 'code': return <pre key={i} className="p-2 rounded bg-[var(--secondary)] text-[11px] overflow-x-auto"><code>{b.content}</code></pre>
          case 'hr': return <hr key={i} className="border-[var(--border)]" />
        }
      })}
    </div>
  )
}

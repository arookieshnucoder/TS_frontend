import katex from 'katex'

export type MathSegment = { type: 'text'; text: string } | { type: 'math'; html: string; display: boolean }
/** Only KaTeX-created markup is inserted. Ordinary model HTML always remains escaped text. */
export function mathSegments(text: string): MathSegment[] {
  const segments: MathSegment[] = []
  const delimiters = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([^\n]*?)\\\)|(?<!\\)\$([^$\n]+?)\$/g
  let offset = 0
  for (const match of text.matchAll(delimiters)) {
    if (match.index > offset) segments.push({ type: 'text', text: text.slice(offset, match.index) })
    const expression = match[1] ?? match[2] ?? match[3] ?? match[4] ?? ''
    const display = match[1] !== undefined || match[2] !== undefined
    try {
      if (expression.length > 4000) throw new Error('Formula too large')
      const html = katex.renderToString(expression, { displayMode: display, trust: false, throwOnError: false, strict: 'ignore', maxSize: 10, maxExpand: 1000 })
      segments.push({ type: 'math', html, display })
    } catch { segments.push({ type: 'text', text: match[0] }) }
    offset = match.index + match[0].length
  }
  if (offset < text.length) segments.push({ type: 'text', text: text.slice(offset) })
  return segments
}

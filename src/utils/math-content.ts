import katex from 'katex'

/** 公式渲染片段；只有 math 分支携带可插入的 KaTeX HTML。 */
export type MathSegment = { type: 'text'; text: string } | { type: 'math'; html: string; display: boolean }
/** 只渲染有明确分隔符的公式，普通 HTML 保持转义文本；渲染失败保留原表达式。 */
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

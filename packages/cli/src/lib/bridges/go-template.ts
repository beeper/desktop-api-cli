import type { BridgeCatalog } from './catalog.js'

type Context = Record<string, unknown>

export function renderBridgeTemplate(catalog: BridgeCatalog, name: string, params: Context): string {
  const template = catalog.templates[name]
  if (template === undefined) throw new Error(`Unknown bridge template ${name}`)
  return renderTemplate(catalog, name, template, params)
}

function renderTemplate(catalog: BridgeCatalog, name: string, template: string, params: Context): string {
  let out = ''
  const tokens = tokenize(template)
  const stack: Array<{ active: boolean; matched: boolean; parentActive: boolean }> = []
  const isActive = () => stack.every(item => item.active)

  for (const token of tokens) {
    if (token.type === 'text') {
      if (isActive()) out += token.value
      continue
    }

    const action = token.value.trim()
    if (action.startsWith('if ')) {
      const parentActive = isActive()
      const condition = Boolean(evalExpr(action.slice(3).trim(), params))
      stack.push({ active: parentActive && condition, matched: condition, parentActive })
    } else if (action.startsWith('else if ')) {
      const current = stack.at(-1)
      if (!current) throw new Error(`Unexpected {{ else if }} in ${name}`)
      const condition = !current.matched && Boolean(evalExpr(action.slice(8).trim(), params))
      current.active = current.parentActive && condition
      current.matched = current.matched || condition
    } else if (action === 'else') {
      const current = stack.at(-1)
      if (!current) throw new Error(`Unexpected {{ else }} in ${name}`)
      current.active = current.parentActive && !current.matched
      current.matched = true
    } else if (action === 'end') {
      if (!stack.pop()) throw new Error(`Unexpected {{ end }} in ${name}`)
    } else if (isActive()) {
      out += String(evalExpr(action, params, catalog) ?? '')
    }
  }
  if (stack.length) throw new Error(`Unclosed {{ if }} block in ${name}`)
  return out
}

function tokenize(template: string): Array<{ type: 'action' | 'text'; value: string }> {
  const tokens: Array<{ type: 'action' | 'text'; value: string }> = []
  let index = 0
  while (index < template.length) {
    const start = template.indexOf('{{', index)
    if (start === -1) {
      tokens.push({ type: 'text', value: template.slice(index) })
      break
    }
    let text = template.slice(index, start)
    const trimLeft = template[start + 2] === '-'
    if (trimLeft) text = text.replace(/[ \t]*$/, '')
    tokens.push({ type: 'text', value: text })
    const end = findActionEnd(template, start + 2)
    if (end === -1) throw new Error('Unclosed template action')
    const trimRight = template[end - 1] === '-'
    const actionStart = start + (trimLeft ? 3 : 2)
    const actionEnd = end - (trimRight ? 1 : 0)
    tokens.push({ type: 'action', value: template.slice(actionStart, actionEnd) })
    index = end + 2
    if (trimRight) {
      const match = template.slice(index).match(/^[ \t]*(?:\r?\n)?/)
      index += match?.[0].length ?? 0
    }
  }
  return tokens
}

function findActionEnd(template: string, start: number): number {
  let quote: string | undefined
  for (let i = start; i < template.length - 1; i++) {
    const ch = template[i]!
    if (quote) {
      if (ch === quote) quote = undefined
    } else if (ch === '"' || ch === '\'' || ch === '`') {
      quote = ch
    } else if (ch === '}' && template[i + 1] === '}') {
      return i
    }
  }
  return -1
}

function evalExpr(expr: string, ctx: Context, catalog?: BridgeCatalog): unknown {
  const parts = splitArgs(expr)
  if (!parts.length) return ''
  const [head, ...rest] = parts
  switch (head) {
    case 'or':
      for (const part of rest) {
        const value = evalExpr(part!, ctx, catalog)
        if (truthy(value)) return value
      }
      return ''
    case 'replace': {
      const [inputValue = '', search = '', replacement = ''] = rest.map(part => String(evalExpr(part!, ctx, catalog) ?? ''))
      return inputValue.split(search).join(replacement)
    }
    case 'setfield': {
      const [, field, valueExpr] = rest
      if (!field || !valueExpr) return ''
      ctx[stripQuotes(field)] = evalExpr(valueExpr, ctx, catalog)
      return ''
    }
    case 'eq':
      return rest.length >= 2 && evalExpr(rest[0]!, ctx, catalog) === evalExpr(rest[1]!, ctx, catalog)
    case 'template': {
      if (!catalog) throw new Error('template function requires a catalog')
      const [templateExpr] = rest
      const templateName = String(evalExpr(templateExpr!, ctx, catalog))
      return renderBridgeTemplate(catalog, templateName, ctx)
    }
    default:
      if (parts.length > 1) throw new Error(`Unsupported template expression: ${expr}`)
      return evalAtom(head!, ctx)
  }
}

function evalAtom(atom: string, ctx: Context): unknown {
  atom = atom.trim()
  if (atom === '.') return ctx
  if (atom === 'true') return true
  if (atom === 'false') return false
  if (/^\d+$/.test(atom)) return Number(atom)
  if (isQuoted(atom)) return stripQuotes(atom)
  if (atom.startsWith('.')) return lookupPath(ctx, atom.slice(1).split('.').filter(Boolean))
  return atom
}

function lookupPath(value: unknown, path: string[]): unknown {
  let current = value
  for (const part of path) {
    if (!current || typeof current !== 'object') return ''
    current = (current as Record<string, unknown>)[part]
  }
  return current ?? ''
}

function splitArgs(expr: string): string[] {
  const out: string[] = []
  let current = ''
  let quote: string | undefined
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]!
    if (quote) {
      current += ch
      if (ch === quote) quote = undefined
    } else if (ch === '"' || ch === '\'' || ch === '`') {
      quote = ch
      current += ch
    } else if (/\s/.test(ch)) {
      if (current) {
        out.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current) out.push(current)
  return out
}

function truthy(value: unknown): boolean {
  return Boolean(value)
}

function isQuoted(value: string): boolean {
  return value.length >= 2 && ['"', '\'', '`'].includes(value[0]!) && value.at(-1) === value[0]
}

function stripQuotes(value: string): string {
  if (!isQuoted(value)) return value
  return value.slice(1, -1)
}

import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYAML } from 'yaml'
import type { CommandSpec, GlobalFlags } from './types.js'
import { usage } from './output.js'

export function enforcePolicy(command: CommandSpec, flags: GlobalFlags): void {
  const profile = flags.safetyProfile ? loadSafetyProfile(flags.safetyProfile) : undefined
  if (profile && !matchesPrefix(profile.allow, command.path)) {
    throw usage(`command "${command.path.join(' ')}" is blocked by safety profile "${profile.name}"`)
  }
}

function loadSafetyProfile(nameOrPath: string): { allow: Set<string>; name: string } {
  const path = resolveProfilePath(nameOrPath)
  if (!path) throw usage(`unknown safety profile "${nameOrPath}"`)
  const root = parseYAML(readFileSync(path, 'utf8')) as Record<string, unknown> | undefined
  return {
    allow: rules(root?.allow),
    name: typeof root?.name === 'string' && root.name.trim() ? root.name.trim() : 'unnamed',
  }
}

function resolveProfilePath(nameOrPath: string): string | undefined {
  if (isAbsolute(nameOrPath) || nameOrPath.includes('/')) return existsSync(nameOrPath) ? nameOrPath : undefined
  const filename = nameOrPath.endsWith('.yaml') ? nameOrPath : `${nameOrPath}.yaml`
  const here = dirname(fileURLToPath(import.meta.url))
  const path = join(dirname(dirname(here)), 'safety-profiles', filename)
  return existsSync(path) ? path : undefined
}

function rules(value: unknown): Set<string> {
  const out = new Set<string>()
  if (!Array.isArray(value)) return out
  for (const item of value) {
    const rule = normalizeRule(String(item))
    if (rule) out.add(rule)
  }
  return out
}

function matchesPrefix(rules: Set<string>, path: string[]): boolean {
  if (rules.has('*') || rules.has('all')) return true
  for (let index = 1; index <= path.length; index += 1) {
    if (rules.has(path.slice(0, index).join('.'))) return true
  }
  return false
}

function normalizeRule(value: string): string {
  return value.trim().toLowerCase().replaceAll(/\s+/g, '.').replaceAll(/^\.+|\.+$/g, '')
}

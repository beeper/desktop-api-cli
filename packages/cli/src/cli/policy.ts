import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYAML } from 'yaml'
import type { CommandSpec, GlobalFlags } from './types.js'
import { usage } from './output.js'

export function enforcePolicy(command: CommandSpec, flags: GlobalFlags): void {
  enforceCommandFilters(command, flags)
  if (flags.readOnly && command.risk !== 'read') {
    throw usage(`read-only mode: command "${command.path.join(' ')}" would intentionally modify Beeper or local CLI state`)
  }
  const profile = flags.safetyProfile ? loadSafetyProfile(flags.safetyProfile) : undefined
  if (profile && !matchesPrefix(profile.allow, command.path)) {
    throw usage(`command "${command.path.join(' ')}" is blocked by safety profile "${profile.name}"`)
  }
  if (command.risk === 'destructive' && !flags.force && !flags.dryRun) {
    throw usage(`destructive command "${command.path.join(' ')}" requires --force or --dry-run`, 'Pass --force to confirm, or --dry-run to preview the action.')
  }
}

export function commandVisible(command: CommandSpec, flags: GlobalFlags): boolean {
  if (command.hidden) return false
  if (flags.readOnly && command.risk !== 'read') return false
  if (!commandAllowedByFilters(command, flags)) return false
  const profile = flags.safetyProfile ? loadSafetyProfile(flags.safetyProfile) : undefined
  return !profile || matchesPrefix(profile.allow, command.path)
}

function enforceCommandFilters(command: CommandSpec, flags: GlobalFlags): void {
  if (commandAllowedByFilters(command, flags)) return
  const path = command.path
  if (rulesFromCSV(flags.disableCommands).size && commandMatchesPrefix(rulesFromCSV(flags.disableCommands), command)) throw usage(`command "${path.join(' ')}" is disabled (blocked by --disable-commands)`)
  throw usage(`command "${path.join(' ')}" is not enabled (set --enable-commands or --enable-commands-exact to allow it)`)
}

function commandAllowedByFilters(command: CommandSpec, flags: GlobalFlags): boolean {
  const allow = rulesFromCSV(flags.enableCommands)
  const exactAllow = rulesFromCSV(flags.enableCommandsExact)
  const deny = rulesFromCSV(flags.disableCommands)
  if (deny.size && commandMatchesPrefix(deny, command)) return false
  if ((allow.size || exactAllow.size) && !commandMatchesPrefix(allow, command) && !commandMatchesExact(exactAllow, command)) return false
  return true
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

function matchesExact(rules: Set<string>, path: string[]): boolean {
  return rules.has('*') || rules.has('all') || rules.has(path.join('.'))
}

function commandMatchesPrefix(rules: Set<string>, command: CommandSpec): boolean {
  return commandPaths(command).some(path => matchesPrefix(rules, path))
}

function commandMatchesExact(rules: Set<string>, command: CommandSpec): boolean {
  return commandPaths(command).some(path => matchesExact(rules, path))
}

function commandPaths(command: CommandSpec): string[][] {
  return [command.path, ...(command.aliases ?? [])]
}

function rulesFromCSV(value?: string): Set<string> {
  const out = new Set<string>()
  for (const part of (value ?? '').split(',')) {
    const rule = normalizeRule(part)
    if (rule) out.add(rule)
  }
  return out
}

function normalizeRule(value: string): string {
  return value.trim().toLowerCase().replaceAll(/\s+/g, '.').replaceAll(/^\.+|\.+$/g, '')
}

#!/usr/bin/env bun
import { readdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const commandsDir = join(root, 'src', 'commands')
const outPath = join(root, 'src', 'commands.generated.ts')

const listAliases: Record<string, string[]> = {
  'accounts:list': ['accounts'],
  'bridges:config': ['bridges:c'],
  'bridges:delete': ['bridges:d'],
  'bridges:list': ['bridges'],
  'bridges:login': ['bridges:l'],
  'bridges:login-password': ['bridges:p'],
  'bridges:proxy': ['bridges:x'],
  'bridges:register': ['bridges:r'],
  'bridges:whoami': ['bridges:w'],
  'chats:list': ['chats', 'accounts:chats', 'ls'],
  'contacts:list': ['contacts'],
  'messages:search': ['search'],
  'send:text': ['send'],
  'targets:list': ['targets'],
}

const files = await listCommandFiles(commandsDir)
const canonicalEntries = files
  .map(file => ({
    command: fileToCommand(file),
    importPath: `./commands/${relative(commandsDir, file).split(sep).join('/').replace(/\.(ts|tsx)$/, '.js')}`,
  }))
  .sort((a, b) => a.command.localeCompare(b.command))
const entries = canonicalEntries
  .flatMap(entry => [entry, ...(listAliases[entry.command] ?? []).map(command => ({ command, importPath: entry.importPath }))])
  .sort((a, b) => a.command.localeCompare(b.command))

const importPaths = canonicalEntries.map(entry => entry.importPath)
const commandImports = new Map(importPaths.map((importPath, index) => [importPath, `Command${index}`]))
const imports = importPaths.map((importPath, index) => `import Command${index} from '${importPath}'`).join('\n')
const mapEntries = entries.map(entry => `  '${entry.command}': ${commandImports.get(entry.importPath)},`).join('\n')

await writeFile(
  outPath,
  `${imports}

export const commands = {
${mapEntries}
}
`,
)

async function listCommandFiles(dir) {
  const output = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      output.push(...await listCommandFiles(path))
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      output.push(path)
    }
  }
  return output
}

function fileToCommand(file) {
  const commandPath = relative(commandsDir, file).split(sep).join('/')
  const parts = commandPath.replace(/\.(ts|tsx)$/, '').split('/')
  return parts.map(part => part === 'index' ? undefined : part).filter(Boolean).join(':')
}

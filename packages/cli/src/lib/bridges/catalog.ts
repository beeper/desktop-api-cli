import { constants as fsConstants } from 'node:fs'
import { access, readFile, readdir } from 'node:fs/promises'
import { basename, delimiter, join } from 'node:path'
import { beeperDir } from '../targets.js'
import {
  generatedBridgeIPSuffix,
  generatedOfficialBridges,
  generatedSupportedBridges,
  generatedTemplates,
  generatedWebsocketBridges,
  type GeneratedOfficialBridge,
} from './generated.js'

export type BridgeCatalog = {
  bridgeIPSuffix: Record<string, string>
  officialBridges: GeneratedOfficialBridge[]
  supportedBridges: string[]
  templates: Record<string, string>
  websocketBridges: Record<string, boolean>
}

type CatalogPlugin = Partial<Pick<BridgeCatalog, 'bridgeIPSuffix' | 'officialBridges' | 'templates' | 'websocketBridges'>>

export async function loadBridgeCatalog(): Promise<BridgeCatalog> {
  const catalog: BridgeCatalog = {
    bridgeIPSuffix: { ...generatedBridgeIPSuffix },
    officialBridges: [...generatedOfficialBridges],
    supportedBridges: [...generatedSupportedBridges],
    templates: { ...generatedTemplates },
    websocketBridges: { ...generatedWebsocketBridges },
  }

  for (const dir of pluginTemplateDirs()) await loadTemplateDir(catalog, dir)
  for (const path of pluginCatalogPaths()) await loadCatalogPlugin(catalog, path)
  catalog.supportedBridges = Object.keys(catalog.templates).map(file => basename(file, '.tpl.yaml')).sort()
  return catalog
}

export function templateName(bridgeType: string): string {
  return `${bridgeType}.tpl.yaml`
}

export function isSupported(catalog: BridgeCatalog, bridgeType: string): boolean {
  return Boolean(catalog.templates[templateName(bridgeType)])
}

function pluginTemplateDirs(): string[] {
  const dirs = [join(beeperDir(), 'bridges', 'templates')]
  const envDirs = process.env.BEEPER_BRIDGE_TEMPLATE_DIR?.split(delimiter).filter(Boolean) ?? []
  return [...dirs, ...envDirs]
}

function pluginCatalogPaths(): string[] {
  const paths = [join(beeperDir(), 'bridges', 'bridges.json')]
  const envPaths = process.env.BEEPER_BRIDGE_CATALOG?.split(delimiter).filter(Boolean) ?? []
  return [...paths, ...envPaths]
}

async function loadTemplateDir(catalog: BridgeCatalog, dir: string): Promise<void> {
  if (!await exists(dir)) return
  const files = (await readdir(dir)).filter(file => file.endsWith('.tpl.yaml'))
  for (const file of files) catalog.templates[file] = await readFile(join(dir, file), 'utf8')
}

async function loadCatalogPlugin(catalog: BridgeCatalog, path: string): Promise<void> {
  if (!await exists(path)) return
  const plugin = JSON.parse(await readFile(path, 'utf8')) as CatalogPlugin
  if (plugin.bridgeIPSuffix) Object.assign(catalog.bridgeIPSuffix, plugin.bridgeIPSuffix)
  if (plugin.websocketBridges) Object.assign(catalog.websocketBridges, plugin.websocketBridges)
  if (plugin.templates) Object.assign(catalog.templates, plugin.templates)
  if (plugin.officialBridges) {
    const byType = new Map(catalog.officialBridges.map(item => [item.typeName, item]))
    for (const item of plugin.officialBridges) byType.set(item.typeName, item)
    catalog.officialBridges = [...byType.values()]
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

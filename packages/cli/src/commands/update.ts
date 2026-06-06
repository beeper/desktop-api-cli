import { Flags } from '@oclif/core'
import { BeeperCommand, ensureWritable } from '../lib/command.js'
import {
  checkInstallationUpdate,
  readInstallations,
  updateServerInstallation,
  updateDesktopInstallation,
  type Installation,
} from '../lib/installations.js'
import { profileStatus, startProfile, stopProfile } from '../lib/profiles.js'
import { listTargets } from '../lib/targets.js'
import { pathSetupHint } from '../lib/env.js'
import { printData } from '../lib/output.js'
import pkg from '../../package.json' with { type: 'json' }

export default class Update extends BeeperCommand {
  static override summary = 'Check and install Beeper updates'
  static override flags = {
    cli: Flags.boolean({ default: false, description: 'Check the Beeper CLI package' }),
    desktop: Flags.boolean({ default: false, description: 'Check the CLI-owned Desktop install' }),
    server: Flags.boolean({ default: false, description: 'Check the CLI-owned Server install' }),
    check: Flags.boolean({ default: false, description: 'Only check for updates; do not install' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Update)
    if (!flags.check) ensureWritable(flags)
    const selected = flags.cli || flags.desktop || flags.server
    const installations = await readInstallations()
    const results: Array<Record<string, unknown>> = []

    if (!selected || flags.cli) {
      results.push({ kind: 'cli', ...(await checkCLI()) })
    }

    if ((!selected || flags.desktop) && installations.desktop) {
      const check = await checkInstallationUpdate(installations.desktop)
      if (check.available && !flags.check) {
        const updated = await updateDesktopInstallation(installations.desktop)
        results.push({ kind: 'desktop', updated: true, previousVersion: installations.desktop.version, currentVersion: updated.version, path: updated.path, action: 'Restart the app to apply the update.' })
      } else {
        results.push({ kind: 'desktop', ...check })
      }
    } else if ((!selected || flags.desktop) && !installations.desktop) {
      results.push({ kind: 'desktop', installed: false, action: 'Run: beeper install desktop' })
    }

    if ((!selected || flags.server) && installations.server) {
      const check = await checkInstallationUpdate(installations.server)
      if (check.available && !flags.check) {
        const runningProfiles = await runningServerProfiles()
        const updated = await updateServerInstallation(installations.server)
        const restartedProfiles = []
        for (const profile of runningProfiles) {
          await stopProfile(profile).catch(() => undefined)
          await startProfile(profile)
          restartedProfiles.push(profile.id)
        }
        results.push({ kind: 'server', updated: true, previousVersion: installations.server.version, currentVersion: updated.version, path: updated.path, restartedProfiles, hint: pathSetupHint() })
      } else {
        results.push({ kind: 'server', ...check })
      }
    } else if ((!selected || flags.server) && !installations.server) {
      results.push({ kind: 'server', installed: false, action: 'Run: beeper install server' })
    }

    await printData(results, flags.json ? 'json' : 'human')
  }
}

async function runningServerProfiles(): Promise<Awaited<ReturnType<typeof listTargets>>> {
  const profiles = (await listTargets()).filter(target => target.managed && target.type === 'server')
  const running = []
  for (const profile of profiles) {
    const status = await profileStatus(profile)
    if (status.running) running.push(profile)
  }
  return running
}

async function checkCLI(): Promise<Record<string, unknown>> {
  const currentVersion = pkg.version
  const installMethod = detectCLIInstallMethod()
  try {
    const response = await fetch('https://api.github.com/repos/beeper/cli/releases/latest', {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'beeper-cli' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`GitHub releases returned ${response.status}`)
    const latest = await response.json() as { tag_name?: string }
    const latestVersion = latest.tag_name?.replace(/^v/, '')
    const available = !!latestVersion && latestVersion !== currentVersion
    return {
      currentVersion,
      latestVersion,
      installMethod: installMethod.kind,
      available,
      action: available ? upgradeAction(installMethod) : 'beeper-cli is up to date.',
    }
  } catch (error) {
    return {
      currentVersion,
      installMethod: installMethod.kind,
      available: false,
      action: `Could not check GitHub releases for beeper-cli updates: ${(error as Error).message}`,
    }
  }
}

type CLIInstallMethod =
  | { kind: 'brew' }
  | { kind: 'npm-global' }
  | { kind: 'git'; path: string }
  | { kind: 'unknown'; path: string }

function detectCLIInstallMethod(): CLIInstallMethod {
  const path = decodeURI(new URL(import.meta.url).pathname)
  if (/\/(Cellar|homebrew|linuxbrew)\//.test(path)) return { kind: 'brew' }
  // bun/npm/yarn global installs end up under `<prefix>/lib/node_modules/...` or `<prefix>/global/...`
  if (/\/(lib\/node_modules|global\/(\d+\.\d+\.\d+\/)?node_modules)\//.test(path)) return { kind: 'npm-global' }
  if (/\/(\.packs|packages\/cli\/dist|packages\/cli\/src)\//.test(path)) return { kind: 'git', path }
  return { kind: 'unknown', path }
}

function upgradeAction(method: CLIInstallMethod): string {
  switch (method.kind) {
    case 'brew':
      return 'Update with: brew upgrade beeper/tap/cli'
    case 'npm-global':
      return 'Update with: npm install -g beeper-cli@latest'
    case 'git':
      return `Update with: git -C ${method.path.split('/packages/')[0]} pull && bun run --filter @beeper/cli build`
    default:
      return 'Update with: brew upgrade beeper/tap/cli  OR  npm install -g beeper-cli@latest'
  }
}

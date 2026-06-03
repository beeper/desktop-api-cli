import { Args, Flags } from '@oclif/core'
import { constants as fsConstants } from 'node:fs'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { platform } from 'node:os'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { ensureWritable } from '../../lib/command.js'
import { BridgeCommand } from '../../lib/bridges/command.js'
import {
  bridgeDataDir,
  compileGoBridge,
  generateBridgeConfig,
  prepareBridgeEnv,
  registerBridge,
  runCommand,
  setupPythonVenv,
  updateGoBridge,
  whoami,
  type GeneratedBridgeConfig,
} from '../../lib/bridges/manager.js'
import { runProxyLoop } from '../../lib/bridges/websocket-proxy.js'

export default class BridgesRun extends BridgeCommand {
  static override summary = 'Run an official Beeper bridge'
  static override args = { bridge: Args.string({ required: true, description: 'Self-hosted bridge name, usually sh-...' }) }
  static override flags = {
    compile: Flags.boolean({ default: process.env.BEEPER_BRIDGE_COMPILE === '1', description: 'Clone the bridge repository and compile locally instead of downloading a CI binary' }),
    'config-file': Flags.string({ char: 'c', default: process.env.BEEPER_BRIDGE_CONFIG_FILE ?? 'config.yaml', description: 'File name to save the config to' }),
    'custom-startup-command': Flags.string({ default: process.env.BEEPER_BRIDGE_CUSTOM_STARTUP_COMMAND, description: 'Custom binary or script to run for startup. Disables update checks.' }),
    env: Flags.string({ description: 'Beeper environment or domain (prod, staging, dev, local, or a domain)' }),
    'local-dev': Flags.boolean({ char: 'l', default: process.env.BEEPER_BRIDGE_LOCAL === '1', description: 'Run the bridge in the current working directory' }),
    'no-override-config': Flags.boolean({ default: process.env.BEEPER_BRIDGE_NO_OVERRIDE_CONFIG === '1', description: "Don't override config file if it already exists" }),
    'no-state': Flags.boolean({ default: false, description: "Don't send a bridge state update" }),
    'no-update': Flags.boolean({ char: 'n', default: process.env.BEEPER_BRIDGE_NO_UPDATE === '1', description: "Don't update the bridge even if it is out of date" }),
    param: Flags.string({ char: 'p', multiple: true, description: 'Bridge-specific config option in key=value form. Repeatable.' }),
    type: Flags.string({ char: 't', default: process.env.BEEPER_BRIDGE_TYPE, description: 'The type of bridge to run.' }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(BridgesRun)
    ensureWritable(flags)
    const env = await prepareBridgeEnv(flags)
    const dataDir = bridgeDataDir(env.envName)
    const bridgeDir = flags['local-dev'] ? process.cwd() : join(dataDir, args.bridge)
    await mkdir(join(bridgeDir, 'logs'), { recursive: true, mode: 0o700 })

    const configPath = join(bridgeDir, flags['config-file'])
    const shouldWriteConfig = !(flags['no-override-config'] || flags['local-dev']) || !await exists(configPath)
    let cfg: GeneratedBridgeConfig
    if (shouldWriteConfig) {
      cfg = await generateBridgeConfig(env, args.bridge, {
        force: flags.force,
        noState: flags['no-state'],
        params: flags.param,
        type: flags.type,
      })
      await writeFile(configPath, cfg.config ?? '', { mode: 0o600 })
    } else {
      const info = await whoami(env)
      const bridgeType = info.user.bridges?.[args.bridge]?.bridgeState?.bridgeType
      if (!bridgeType) {
        cfg = await generateBridgeConfig(env, args.bridge, {
          force: flags.force,
          noState: flags['no-state'],
          params: flags.param,
          type: flags.type,
        })
        await writeFile(configPath, cfg.config ?? '', { mode: 0o600 })
      } else {
        const reg = await registerBridge(env, args.bridge, { bridgeType, force: flags.force, get: true, noState: flags['no-state'] })
        cfg = { ...reg, bridgeType }
      }
      process.stderr.write(`Config already exists, not overriding - delete ${configPath} to regenerate it\n`)
    }

    const startup = await prepareStartup({
      bridgeDir,
      cfg,
      compile: flags.compile,
      configFile: flags['config-file'],
      customStartupCommand: flags['custom-startup-command'],
      dataDir,
      localDev: flags['local-dev'],
      noUpdate: flags['no-update'],
    })
    process.stderr.write(`Starting ${cfg.bridgeType}\n`)
    await runBridgeProcess({ ...startup, bridgeDir, cfg, env })
  }
}

async function prepareStartup(options: {
  bridgeDir: string
  cfg: GeneratedBridgeConfig
  compile: boolean
  configFile: string
  customStartupCommand?: string
  dataDir: string
  localDev: boolean
  noUpdate: boolean
}): Promise<{ command: string; args: string[]; needsWebsocketProxy: boolean }> {
  const goBridges = ['imessage', 'imessagego', 'whatsapp', 'discord', 'slack', 'gmessages', 'gvoice', 'signal', 'meta', 'twitter', 'bluesky', 'linkedin', 'telegram']
  if (goBridges.includes(options.cfg.bridgeType)) {
    const binaryName = options.cfg.bridgeType === 'imessagego' ? 'beeper-imessage' : `mautrix-${options.cfg.bridgeType}`
    let command = join(options.dataDir, 'binaries', binaryName)
    if (options.customStartupCommand) {
      command = options.customStartupCommand
    } else if (options.localDev) {
      command = join(options.bridgeDir, binaryName)
      await runCommand('./build.sh', [], options.bridgeDir)
    } else if (options.compile) {
      const buildDir = join(options.dataDir, 'compile', binaryName)
      command = join(buildDir, binaryName)
      await compileGoBridge(buildDir, command, options.cfg.bridgeType, options.noUpdate)
    } else {
      await updateGoBridge(command, options.cfg.bridgeType, options.noUpdate)
    }
    return { command, args: ['-c', options.configFile], needsWebsocketProxy: false }
  }
  if (options.cfg.bridgeType === 'googlechat') {
    const command = options.customStartupCommand ?? join(await setupPythonVenv(options.bridgeDir, options.cfg.bridgeType, options.localDev), 'bin', 'python3')
    return { command, args: ['-m', 'mautrix_googlechat', '-c', options.configFile], needsWebsocketProxy: true }
  }
  if (options.cfg.bridgeType === 'heisenbridge') {
    const command = options.customStartupCommand ?? join(await setupPythonVenv(options.bridgeDir, options.cfg.bridgeType, options.localDev), 'bin', 'python3')
    return {
      command,
      args: ['-m', 'heisenbridge', '-c', options.configFile, '-o', options.cfg.your_user_id, options.cfg.homeserver_url.replace('https://', 'wss://')],
      needsWebsocketProxy: false,
    }
  }
  throw new Error('Unsupported bridge type for beeper bridges run')
}

async function runBridgeProcess(options: {
  args: string[]
  bridgeDir: string
  cfg: GeneratedBridgeConfig
  command: string
  env: { domain: string }
  needsWebsocketProxy: boolean
}): Promise<void> {
  const controller = new AbortController()
  const child = spawn(options.command, options.args, {
    cwd: options.bridgeDir,
    detached: platform() === 'linux',
    stdio: 'inherit',
  })
  let proxyDone: Promise<void> | undefined
  if (options.needsWebsocketProxy) {
    proxyDone = runProxyLoop(controller.signal, options.cfg.homeserver_url, options.cfg.registration)
    proxyDone.catch(error => {
      process.stderr.write(`Websocket proxy exited: ${(error as Error).message}\n`)
      child.kill('SIGTERM')
    })
  }
  const shutdown = () => {
    controller.abort()
    if (platform() === 'linux' && child.pid) process.kill(-child.pid, 'SIGTERM')
    else child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 3000).unref()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  const [code, signal] = await once(child, 'exit') as [number | null, NodeJS.Signals | null]
  controller.abort()
  if (proxyDone) await proxyDone.catch(() => undefined)
  if (code !== 0) throw new Error(`${options.command} exited with ${signal ?? code}`)
  process.stderr.write('Bridge exited\n')
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

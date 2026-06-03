import { Args, Flags } from '@oclif/core'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { ensureWritable, isForce } from '../../lib/command.js'
import { BridgeCommand } from '../../lib/bridges/command.js'
import { bridgeDataDir, deleteBridge, prepareBridgeEnv, validateBridgeID, whoami } from '../../lib/bridges/manager.js'

export default class BridgesDelete extends BridgeCommand {
  static override summary = 'Delete a bridge and all associated rooms on the Beeper servers'
  static override aliases = ['bridges:d']
  static override args = { bridge: Args.string({ required: true, description: 'Bridge name' }) }
  static override flags = {
    env: Flags.string({ description: 'Beeper environment or domain (prod, staging, dev, local, or a domain)' }),
    'local-dev': Flags.boolean({ char: 'l', default: process.env.BEEPER_BRIDGE_LOCAL === '1', description: 'Delete bridge database and config from the current working directory' }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(BridgesDelete)
    ensureWritable(flags)
    if (args.bridge === 'hungryserv') throw new Error("You really shouldn't do that")
    validateBridgeID(args.bridge)
    const env = await prepareBridgeEnv(flags)
    const bridgeDir = flags['local-dev'] ? process.cwd() : join(bridgeDataDir(env.envName), args.bridge)

    if (!flags.force) {
      const info = await whoami(env)
      const bridgeInfo = info.user.bridges?.[args.bridge]
      if (!bridgeInfo) throw new Error(`You don't have a ${args.bridge} bridge.`)
      if (!bridgeInfo.bridgeState?.isSelfHosted) throw new Error(`Your ${args.bridge} bridge is not self-hosted.`)
    }

    if (!isForce(flags)) {
      const confirmed = await confirm(`Are you sure you want to permanently delete ${args.bridge}?`)
      if (!confirmed) throw new Error('bridge delete cancelled')
    }
    await deleteBridge(env, args.bridge)
    process.stdout.write('Started deleting bridge\n')
    await deleteLocalBridgeData(bridgeDir, !flags['local-dev'])
  }
}

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input, output })
  try {
    const answer = (await rl.question(`${message} [y/N] `)).trim().toLowerCase()
    return answer === 'y' || answer === 'yes'
  } finally {
    rl.close()
  }
}

async function deleteLocalBridgeData(bridgeDir: string, deleteWholeDir: boolean): Promise<void> {
  if (deleteWholeDir) {
    await rm(bridgeDir, { force: true, recursive: true })
    process.stderr.write(`Deleted local bridge data from ${bridgeDir}\n`)
    return
  }
  for (const item of await readdir(bridgeDir).catch(() => [])) {
    if (isLocalBridgeFile(item)) await rm(join(bridgeDir, item), { force: true })
  }
  process.stderr.write(`Deleted local bridge data from ${bridgeDir}\n`)
}

function isLocalBridgeFile(name: string): boolean {
  return name === 'config.yaml' || name.endsWith('.db') || name.endsWith('.db-shm') || name.endsWith('.db-wal')
}

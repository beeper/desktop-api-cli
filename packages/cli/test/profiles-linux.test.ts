import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { desktopInstallDir, writeInstallations, type Installation } from '../src/lib/installations.js'
import { findDesktopAppPath, launchDesktopApp } from '../src/lib/profiles.js'

const originalPath = process.env.PATH
const originalConfigDir = process.env.BEEPER_CLI_CONFIG_DIR
const originalCapture = process.env.BEEPER_TEST_CAPTURE
const originalOpenCapture = process.env.BEEPER_TEST_OPEN_CAPTURE

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'beeper-cli-linux-profile-'))
  process.env.BEEPER_CLI_CONFIG_DIR = join(tempDir, 'config')
  process.env.PATH = join(tempDir, 'bin') + ':' + (originalPath ?? '')
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
  restoreEnvironment('PATH', originalPath)
  restoreEnvironment('BEEPER_CLI_CONFIG_DIR', originalConfigDir)
  restoreEnvironment('BEEPER_TEST_CAPTURE', originalCapture)
  restoreEnvironment('BEEPER_TEST_OPEN_CAPTURE', originalOpenCapture)
})

describe('Linux Desktop profiles', () => {
  it('launches an installed executable directly with the profile environment and arguments', async () => {
    const appPath = join(tempDir, 'Beeper')
    const capturePath = join(tempDir, 'app-capture')
    const openCapturePath = join(tempDir, 'open-capture')
    const openPath = join(tempDir, 'bin', 'open')
    const dataDir = join(tempDir, 'profile-data')
    await mkdir(dirname(appPath), { recursive: true })
    await mkdir(dirname(openPath), { recursive: true })
    await writeCaptureScript(appPath)
    await writeOpenScript(openPath)
    process.env.BEEPER_TEST_CAPTURE = capturePath
    process.env.BEEPER_TEST_OPEN_CAPTURE = openCapturePath
    const installation: Installation = {
      kind: 'desktop',
      channel: 'stable',
      serverEnv: 'production',
      bundleID: 'com.automattic.beeper.desktop',
      path: appPath,
      feedURL: 'https://api.beeper.com/desktop/update-feed.json',
      downloadURL: 'https://api.beeper.com/desktop/download/linux/x64/stable/com.automattic.beeper.desktop',
      installedAt: '2026-08-09T00:00:00.000Z',
      updatedAt: '2026-08-09T00:00:00.000Z',
    }
    await writeInstallations({ desktop: installation })

    await launchDesktopApp({
      id: 'linux-profile',
      type: 'desktop',
      baseURL: 'http://127.0.0.1:23456',
      managed: true,
      profile: 'linux-profile',
      dataDir,
      port: 23456,
      serverEnv: 'staging',
    })

    const capture = await waitForFile(capturePath)
    expect(capture).toContain('profile=linux-profile\n')
    expect(capture).toContain(`dataDir=${dataDir}\n`)
    expect(capture).toContain('multiple=true\n')
    expect(capture).toContain('arg=--no-enforce-app-location\n')
    expect(capture).toContain('arg=--pas-port=23456\n')
    expect(capture).toContain('arg=--server-env=staging\n')
    expect(await fileExists(openCapturePath)).toBe(false)
  })

  it('discovers an AppImage in the managed Desktop installation directory', async () => {
    const appPath = join(desktopInstallDir(), 'Beeper-1.2.3.AppImage')
    await mkdir(dirname(appPath), { recursive: true })
    await writeFile(appPath, '#!/bin/sh\n')
    await chmod(appPath, 0o755)

    expect(await findDesktopAppPath()).toBe(appPath)
  })
})

async function writeCaptureScript(path: string): Promise<void> {
  await writeFile(path, `#!/bin/sh
{
  printf 'profile=%s\\n' "$BEEPER_PROFILE"
  printf 'dataDir=%s\\n' "$BEEPER_USER_DATA_DIR"
  printf 'multiple=%s\\n' "$ALLOW_MULTIPLE_INSTANCES"
  for arg in "$@"; do printf 'arg=%s\\n' "$arg"; done
} > "$BEEPER_TEST_CAPTURE"
`)
  await chmod(path, 0o755)
}

async function writeOpenScript(path: string): Promise<void> {
  await writeFile(path, `#!/bin/sh
printf 'open\\n' > "$BEEPER_TEST_OPEN_CAPTURE"
`)
  await chmod(path, 0o755)
}

async function waitForFile(path: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      return await readFile(path, 'utf8')
    } catch {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
  throw new Error(`Timed out waiting for ${path}`)
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

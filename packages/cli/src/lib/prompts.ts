import { stdin as input, stdout as defaultOutput } from 'node:process'
import { createInterface } from 'node:readline/promises'
import type { Writable } from 'node:stream'

export async function promptText(label: string, output: Writable = defaultOutput): Promise<string> {
  const rl = createInterface({ input, output })
  try {
    return (await rl.question(label)).trim()
  } finally {
    rl.close()
  }
}

export async function promptConfirm(label: string, defaultYes = false, output?: Writable): Promise<boolean> {
  const value = (await promptText(`${label} ${defaultYes ? '[Y/n]' : '[y/N]'} `, output)).toLowerCase()
  if (!value) return defaultYes
  return value === 'y' || value === 'yes'
}

export async function promptChoice(
  label: string,
  choices: string[],
  options: { defaultValue?: string; output?: Writable } = {},
): Promise<string> {
  if (!choices.length) throw new Error('promptChoice requires at least one choice')
  const out = options.output ?? defaultOutput
  for (;;) {
    const answer = await promptText(label, out)
    const value = answer || options.defaultValue
    const index = value && /^\d+$/.test(value) ? Number.parseInt(value, 10) : 0
    if (index >= 1 && index <= choices.length) return choices[index - 1]!
    if (value && choices.includes(value)) return value
    out.write(`Choose one of: ${choices.join(', ')}\n`)
  }
}

const SERVER_ENVIRONMENTS = ['local', 'dev', 'staging', 'prod'] as const

export type ServerEnv = typeof SERVER_ENVIRONMENTS[number]

export const SERVER_ENV_API_BASE_URLS: Record<ServerEnv, string> = {
  local: 'https://api.beeper.localtest.me',
  dev: 'https://api.beeper-dev.com',
  staging: 'https://api.beeper-staging.com',
  prod: 'https://api.beeper.com',
}

export function normalizeServerEnv(value?: string): ServerEnv {
  if (!value || value === 'prod' || value === 'production') return 'prod'
  if (value === 'local' || value === 'dev' || value === 'staging') return value
  throw new Error(`Unsupported server env "${value}". Expected local, dev, staging, or prod.`)
}

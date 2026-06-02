import { app, shell } from 'electron'
import { get } from 'https'
import type { AppUpdateInfo } from '../../shared/types'

const REPOSITORY_URL = 'https://github.com/doanhnguyen1311/private-note'
const BRANCH = 'master'
const PACKAGE_JSON_URL = `${REPOSITORY_URL.replace('github.com', 'raw.githubusercontent.com')}/${BRANCH}/package.json`

interface RemotePackageJson {
  version?: string
}

export async function checkForUpdates(): Promise<AppUpdateInfo> {
  const currentVersion = app.getVersion()
  const remotePackage = await fetchJson<RemotePackageJson>(PACKAGE_JSON_URL)
  const latestVersion = remotePackage.version

  if (!latestVersion) {
    throw new Error('GitHub package.json does not include a version.')
  }

  return {
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    repositoryUrl: REPOSITORY_URL,
    branch: BRANCH,
    checkedAt: new Date().toISOString()
  }
}

export async function openUpdateRepository(): Promise<void> {
  await shell.openExternal(REPOSITORY_URL)
}

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = get(url, { timeout: 12000 }, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        response.resume()
        reject(new Error(`GitHub responded with HTTP ${response.statusCode}.`))
        return
      }

      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        body += chunk
      })
      response.on('end', () => {
        try {
          resolve(JSON.parse(body) as T)
        } catch (error) {
          reject(error)
        }
      })
    })

    request.on('timeout', () => {
      request.destroy(new Error('Update check timed out.'))
    })
    request.on('error', reject)
  })
}

function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersion(left)
  const rightParts = normalizeVersion(right)
  const maxLength = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0
    const rightPart = rightParts[index] ?? 0
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1
  }

  return 0
}

function normalizeVersion(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0))
}

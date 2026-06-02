const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const REPO_URL = 'https://github.com/doanhnguyen1311/private-note.git'
const BRANCH = 'main'
const ROOT = path.resolve(__dirname, '..')
const PACKAGE_JSON = path.join(ROOT, 'package.json')

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe'
  }).trim()
}

function hasCommand(command, args) {
  try {
    run(command, args)
    return true
  } catch {
    return false
  }
}

function getPackageVersion() {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')).version
}

function assertCleanWorktree() {
  const dirty = run('git', ['status', '--porcelain'])
  if (!dirty || process.env.UPDATE_ALLOW_DIRTY === '1') return

  console.error('Worktree has local changes. Commit or stash them before updating from GitHub.')
  console.error('If you understand the risk, rerun with UPDATE_ALLOW_DIRTY=1.')
  process.exit(1)
}

function getCurrentHead() {
  try {
    return run('git', ['rev-parse', 'HEAD'])
  } catch {
    return null
  }
}

function main() {
  if (!hasCommand('git', ['--version'])) {
    console.error('Git is required to update from GitHub.')
    process.exit(1)
  }

  assertCleanWorktree()

  const beforeHead = getCurrentHead()
  const beforeVersion = getPackageVersion()

  console.log(`Fetching ${REPO_URL} ${BRANCH}...`)
  run('git', ['fetch', REPO_URL, BRANCH], { stdio: 'inherit' })

  const remoteHead = run('git', ['rev-parse', 'FETCH_HEAD'])
  if (beforeHead === remoteHead) {
    console.log(`Already up to date on ${BRANCH}. Version stays ${beforeVersion}.`)
    return
  }

  console.log(`Pulling latest ${BRANCH} with fast-forward only...`)
  run('git', ['pull', '--ff-only', REPO_URL, BRANCH], { stdio: 'inherit' })

  console.log('Bumping patch version...')
  run('npm', ['version', 'patch', '--no-git-tag-version'], { stdio: 'inherit' })

  const afterVersion = getPackageVersion()
  console.log(`Updated from ${beforeHead || 'no local HEAD'} to ${remoteHead}.`)
  console.log(`Version changed from ${beforeVersion} to ${afterVersion}.`)
}

main()

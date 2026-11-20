import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { SHOT_RECIPES, RECIPE_KEYS, DEFAULTS, RAW_BASE, WORK_DIR } from './config.mjs'
import {
  ensureDir,
  exists,
  formatBytes,
  hasCommand,
  pngSize,
  readJson,
  rootPath,
  run,
  sha256,
  writeJson
} from './util.mjs'

function render (value, vars, encodeSearch = false) {
  if (typeof value !== 'string') return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const raw = vars[key] ?? ''
    if (encodeSearch && key === 'search') return encodeURIComponent(raw)
    return raw
  })
}

function renderDeep (value, vars) {
  if (Array.isArray(value)) return value.map(item => renderDeep(item, vars))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderDeep(item, vars)]))
  }
  return render(value, vars)
}

function materialize (shot, plan, args) {
  const recipe = SHOT_RECIPES[shot.recipe]
  if (!recipe) throw new Error(`Unknown recipe: ${shot.recipe}`)
  const vars = { ...DEFAULTS, ...(plan.vars || {}), ...args }
  const merged = {
    ...recipe,
    ...shot,
    route: shot.route || render(recipe.route, { ...vars, search: encodeURIComponent(vars.search || '') }),
    alt: shot.alt || recipe.alt,
    caption: shot.caption || recipe.caption
  }
  return renderDeep(merged, vars)
}

function parseCrop (crop) {
  if (!crop) return null
  const match = String(crop).match(/^(\d+)x(\d+)\+(-?\d+)\+(-?\d+)$/)
  if (!match) throw new Error(`Invalid crop "${crop}" (expected 1280x820+80+50)`)
  return { width: Number(match[1]), height: Number(match[2]), x: Number(match[3]), y: Number(match[4]) }
}

async function ping (url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

async function ensureServer (baseUrl, args) {
  const url = new URL(baseUrl)
  if (await ping(baseUrl)) return { proc: null, started: false }
  if (args.build) {
    console.log('Building dist/spa…')
    const command = exists('bun.lock') ? 'bun' : 'npm'
    run(command, ['run', 'build'], { stdio: 'inherit' })
  }
  if (!exists('dist/spa/index.html')) {
    throw new Error('dist/spa/index.html is missing. Run `bun run build` or pass --build.')
  }
  const proc = spawn(process.execPath, ['scripts/serve-dist.mjs'], {
    cwd: rootPath('.'),
    env: { ...process.env, PORT: url.port || '4173', HOST: url.hostname || '127.0.0.1' },
    stdio: 'ignore'
  })
  for (let i = 0; i < 60; i++) {
    if (await ping(baseUrl)) return { proc, started: true }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  proc.kill('SIGTERM')
  throw new Error(`Timed out waiting for ${baseUrl}`)
}

async function waitForText (page, text, options = {}) {
  const locator = page.getByText(text, { exact: options.exact || false })
  const chosen = options.last ? locator.last() : locator.first()
  await chosen.waitFor({ state: 'visible', timeout: options.timeout || 30000 })
}

async function applyActions (page, actions = []) {
  for (const action of actions) {
    if (action.waitMs) await page.waitForTimeout(action.waitMs)
    if (action.waitForText) await waitForText(page, action.waitForText, action)
    if (action.press) await page.keyboard.press(action.press)
    if (action.clickRole) {
      const locator = page.getByRole(action.role || 'button', { name: new RegExp(action.name, action.flags || 'i') })
      await locator.nth(action.index ?? 0).click()
    }
    if (action.clickText) {
      const locator = page.getByText(action.clickText, { exact: action.exact || false })
      await locator.nth(action.last ? -1 : action.index ?? 0).click()
    }
    if (action.clickSelector) {
      await page.locator(action.clickSelector).nth(action.index ?? 0).click()
    }
    if (action.fill) {
      await page.locator(action.fill).first().fill(action.value ?? '')
    }
    if (action.type) {
      const locator = page.locator(action.type).first()
      await locator.click()
      await locator.pressSequentially(action.value ?? '', { delay: action.delay ?? 2 })
    }
    if (action.scrollY !== undefined) {
      await page.evaluate(value => window.scrollTo(0, value), action.scrollY)
    }
    if (action.scrollToText) {
      const locator = page.getByText(action.scrollToText, { exact: action.exact || false })
      const chosen = action.last ? locator.last() : locator.first()
      await chosen.evaluate((el, offset) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset), action.offset ?? 70)
    }
    if (action.scrollToSelector) {
      await page.locator(action.scrollToSelector).first().evaluate((el, offset) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset), action.offset ?? 70)
    }
    if (action.wheelSelector) {
      const box = await page.locator(action.wheelSelector).first().boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 500))
        await page.mouse.wheel(0, action.deltaY ?? 800)
      }
    }
  }
}

async function captureShot (browser, shot, plan, baseUrl) {
  const viewport = shot.viewport || { width: 1440, height: 1100 }
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    isMobile: Boolean(viewport.isMobile),
    hasTouch: Boolean(viewport.hasTouch)
  })
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  await page.goto(baseUrl + shot.route, { waitUntil: 'domcontentloaded', timeout: 60000 })
  if (shot.waitMs) await page.waitForTimeout(shot.waitMs)
  if (shot.waitForText) await waitForText(page, shot.waitForText, shot)
  await applyActions(page, shot.actions || [])

  const name = shot.name || shot.recipe
  const file = `${plan.output}/${String(shot.index).padStart(2, '0')}-${name}.png`
  const abs = rootPath(file)
  ensureDir(plan.output)

  if (shot.element) {
    await page.locator(shot.element).first().screenshot({ path: abs, animations: 'disabled' })
  } else {
    const clip = parseCrop(shot.crop)
    const options = { path: abs, animations: 'disabled' }
    if (clip) options.clip = clip
    if (shot.fullPage) options.fullPage = true
    await page.screenshot(options)
  }

  const buffer = readFileSync(abs)
  const size = pngSize(buffer)
  await context.close()
  return {
    name,
    recipe: shot.recipe,
    surface: shot.surface || '',
    route: shot.route,
    file,
    url: `${RAW_BASE}/${file}`,
    alt: shot.alt,
    caption: shot.caption,
    bytes: buffer.length,
    width: size?.width || 0,
    height: size?.height || 0,
    sha256: sha256(buffer),
    crop: shot.crop || '',
    element: shot.element || ''
  }
}

function contactSheet (results, output) {
  if (!results.length || !hasCommand('magick')) return null
  const sheet = `${output}/contact-sheet.png`
  const args = ['montage', ...results.map(item => rootPath(item.file)), '-tile', '4x', '-geometry', '480x+8+8', '-background', '#11151c', rootPath(sheet)]
  const result = run('magick', args, { allowFail: true })
  return result.status === 0 ? sheet : null
}

export async function shots (args) {
  if (args.list) {
    console.log(RECIPE_KEYS.join('\n'))
    return []
  }
  const slug = args.slug || ''
  const planPath = args.plan || (slug ? `${WORK_DIR}/${slug}/shots.json` : '')
  if (!planPath) throw new Error('Pass --plan .devlog/<slug>/shots.json or --slug <slug>')
  const plan = readJson(planPath)
  if (!plan) throw new Error(`Could not read ${planPath}`)
  const baseUrl = args['base-url'] || plan.baseUrl || DEFAULTS.baseUrl
  const only = args.only ? new Set(String(args.only).split(',').map(item => item.trim())) : null
  const enabled = (plan.shots || []).filter(shot => shot.enabled !== false)
  const selected = enabled
    .map((shot, index) => materialize({ ...shot, index: index + 1 }, plan, args))
    .filter(shot => !only || only.has(shot.recipe) || only.has(shot.name))

  if (!selected.length) throw new Error('No shots selected')
  console.log(`Capturing ${selected.length} screenshot(s) at ${baseUrl}`)
  const server = await ensureServer(baseUrl, args)
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  const results = []
  const failures = []
  try {
    for (const shot of selected) {
      try {
        const result = await captureShot(browser, shot, plan, baseUrl)
        results.push(result)
        console.log(`  ✓ ${result.file} (${result.width}×${result.height}, ${formatBytes(result.bytes)})`)
      } catch (error) {
        failures.push({ shot: shot.recipe, message: error.message })
        console.error(`  ✗ ${shot.recipe}: ${error.message}`)
      }
    }
  } finally {
    await browser.close()
    if (server.proc) server.proc.kill('SIGTERM')
  }

  const manifest = {
    slug: plan.slug || slug,
    generatedAt: new Date().toISOString(),
    baseUrl,
    output: plan.output,
    shots: results,
    failures
  }
  const manifestPath = plan.slug || slug ? `${WORK_DIR}/${plan.slug || slug}/shots-results.json` : `${plan.output}/shots-results.json`
  writeJson(manifestPath, manifest)
  const sheet = contactSheet(results, plan.output)
  if (sheet) console.log(`  contact sheet: ${sheet}`)
  if (failures.length) {
    console.error(`${failures.length} shot(s) failed`)
    process.exitCode = 1
  }
  return results
}

export function listRecipes () {
  return RECIPE_KEYS
}

export function rawUrl (file) {
  return `${RAW_BASE}/${file}`
}

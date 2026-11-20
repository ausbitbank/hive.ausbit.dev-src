import { statSync } from 'node:fs'
import { RAW_BASE, SHOT_ROOT } from './config.mjs'
import { exists, formatBytes, gitMaybe, listFiles, rootPath, run } from './util.mjs'

export function packageShots (args) {
  const slug = args.slug
  if (!slug) throw new Error('Pass --slug <slug>')
  const dir = args.dir || `${SHOT_ROOT}/${slug}`
  if (!exists(dir)) throw new Error(`No screenshot directory: ${dir}`)
  const files = listFiles(dir, path => /\/\d{2,3}-[^/]+\.(png|jpe?g|webp)$/i.test(path))
  if (!files.length) throw new Error(`No images in ${dir}`)
  const total = files.reduce((sum, file) => sum + (exists(file) ? statSync(rootPath(file)).size : 0), 0)

  console.log(`Packaging ${files.length} images from ${dir} (${formatBytes(total)})`)
  if (args['dry-run']) {
    for (const file of files) console.log(`  ${file}`)
    return { dir, files }
  }

  run('git', ['add', '--', dir])
  const staged = gitMaybe(['diff', '--cached', '--name-only'])
  if (!staged) {
    console.log('  no staged changes')
  } else {
    const message = args.message || `docs: add ${slug} devlog screenshots`
    const commitArgs = args.amend ? ['commit', '--amend', '--no-edit'] : ['commit', '-m', message]
    run('git', commitArgs, { stdio: 'inherit' })
  }

  if (args.tag) {
    const tag = args.tag === true ? `devlog-${slug}` : String(args.tag)
    run('git', ['tag', '-f', tag], { stdio: 'inherit' })
    console.log(`  tag ${tag}`)
  }

  if (args.push) {
    run('git', ['push'], { stdio: 'inherit' })
    if (args.tag) run('git', ['push', '--tags'], { stdio: 'inherit' })
  }

  const head = gitMaybe(['rev-parse', '--short', 'HEAD'])
  console.log(`  commit ${head || '(none)'}`)
  console.log(`  raw base ${RAW_BASE}/${dir}/`)
  console.log('  draft was not committed')
  return { dir, files, commit: head }
}

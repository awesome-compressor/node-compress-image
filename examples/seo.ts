import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'
import { compressDetailed, compressFiles, compressVariants } from '../src/index'

async function ensureInputImage(inputPath?: string): Promise<string> {
  if (inputPath)
    return inputPath

  const generatedDir = path.resolve('tmp/example-seo/source')
  const generatedPath = path.join(generatedDir, 'modern-office-dashboard.png')

  await fs.mkdir(generatedDir, { recursive: true })
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: '#f5d7a1',
    },
  })
    .composite([
      {
        input: Buffer.from(`
          <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
            <rect x="96" y="88" width="1008" height="454" rx="36" fill="#19324d"/>
            <rect x="154" y="154" width="360" height="56" rx="14" fill="#f9faf4"/>
            <rect x="154" y="250" width="260" height="34" rx="10" fill="#89c2a8"/>
            <rect x="154" y="318" width="760" height="28" rx="8" fill="#f2a65a"/>
            <rect x="154" y="374" width="640" height="28" rx="8" fill="#f9faf4"/>
            <circle cx="968" cy="188" r="72" fill="#89c2a8"/>
            <circle cx="986" cy="396" r="104" fill="#f2a65a"/>
          </svg>
        `),
      },
    ])
    .png()
    .toFile(generatedPath)

  return generatedPath
}

async function example() {
  const inputPath = await ensureInputImage(process.argv[2])
  const outputDir = path.resolve('tmp/example-seo/dist')
  const source = await fs.readFile(inputPath)
  const baseName = path.basename(inputPath, path.extname(inputPath)).toLowerCase().replace(/[^a-z0-9]+/g, '-')

  await fs.mkdir(outputDir, { recursive: true })

  const fallback = await compressDetailed(source, {
    quality: 0.82,
    maxWidth: 1200,
    format: 'jpeg',
    targetBytes: 220 * 1024,
    strategy: 'targetSize',
    metadata: 'strip',
  })

  const variants = await compressVariants(source, {
    quality: 0.82,
    maxWidth: 1200,
    formats: ['avif', 'webp'],
    type: 'buffer',
    metadata: 'strip',
  })

  const fallbackPath = path.join(outputDir, `${baseName}.jpg`)
  await fs.writeFile(fallbackPath, fallback.output)

  for (const variant of variants) {
    await fs.writeFile(path.join(outputDir, `${baseName}.${variant.format}`), variant.result.output)
  }

  const batchResults = await compressFiles([inputPath], {
    outputDir,
    cacheFile: path.join(outputDir, '.compress-cache.json'),
    quality: 0.82,
    maxWidth: 1200,
    format: 'webp',
    concurrency: 2,
    metadata: 'strip',
  })

  const width = fallback.metadata.output.width ?? 1200
  const height = fallback.metadata.output.height ?? 630

  console.log('SEO image assets generated:')
  console.log(`- JPEG fallback: ${fallbackPath} (${fallback.compressedSize} bytes)`)
  for (const variant of variants) {
    console.log(`- ${variant.format.toUpperCase()}: ${path.join(outputDir, `${baseName}.${variant.format}`)} (${variant.result.compressedSize} bytes)`)
  }
  console.log(`- Batch cache skipped: ${batchResults[0].skipped}`)
  console.log()
  console.log('HTML snippet:')
  console.log(`<picture>
  <source srcset="/images/${baseName}.avif" type="image/avif">
  <source srcset="/images/${baseName}.webp" type="image/webp">
  <img
    src="/images/${baseName}.jpg"
    width="${width}"
    height="${height}"
    alt="Modern office dashboard analytics"
    loading="lazy"
    decoding="async"
  >
</picture>`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  example().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

export { example }

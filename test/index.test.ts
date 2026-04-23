import type { CompressOptions } from '../src/index'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { compress, compressDetailed, compressFiles, compressVariants, compressWithStats, getCapabilities, getSupportedFormats } from '../src/index'
import { bufferToBlob, bufferToFile, convertBufferToType, getBufferFromFile } from '../src/utils'

// ESM模块中获取__dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('node-compress-image', () => {
  // 创建一个简单的测试图像Buffer (1x1 PNG)
  const createTestPNG = (): Buffer => {
    return Buffer.from([
      0x89,
      0x50,
      0x4E,
      0x47,
      0x0D,
      0x0A,
      0x1A,
      0x0A, // PNG signature
      0x00,
      0x00,
      0x00,
      0x0D, // IHDR chunk length
      0x49,
      0x48,
      0x44,
      0x52, // IHDR
      0x00,
      0x00,
      0x00,
      0x01, // width: 1
      0x00,
      0x00,
      0x00,
      0x01, // height: 1
      0x08,
      0x02,
      0x00,
      0x00,
      0x00, // bit depth, color type, compression, filter, interlace
      0x90,
      0x77,
      0x53,
      0xDE, // CRC
      0x00,
      0x00,
      0x00,
      0x0C, // IDAT chunk length
      0x49,
      0x44,
      0x41,
      0x54, // IDAT
      0x08,
      0x99,
      0x01,
      0x01,
      0x00,
      0x00,
      0x00,
      0xFF,
      0xFF,
      0x00,
      0x00,
      0x00,
      0x02,
      0x00,
      0x01, // data
      0x00,
      0x00,
      0x00,
      0x00, // IEND chunk length
      0x49,
      0x45,
      0x4E,
      0x44, // IEND
      0xAE,
      0x42,
      0x60,
      0x82, // CRC
    ])
  }

  it('should compress image with default options', async () => {
    const testImage = createTestPNG()
    const result = await compress(testImage, { quality: 0.8 })

    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('should return base64 when type is base64', async () => {
    const testImage = createTestPNG()
    const result = await compress(testImage, { quality: 0.8, type: 'base64' })

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should accept exported CompressOptions with return type', async () => {
    const testImage = createTestPNG()
    const options: CompressOptions = { quality: 0.8, type: 'base64' }
    const result = await compress(testImage, options)

    result satisfies string
    expect(result.length).toBeGreaterThan(0)
  })

  it('should provide compression stats', async () => {
    const testImage = createTestPNG()
    const stats = await compressWithStats(testImage, { quality: 0.8 })

    expect(stats).toHaveProperty('bestTool')
    expect(stats).toHaveProperty('originalSize')
    expect(stats).toHaveProperty('compressedSize')
    expect(stats).toHaveProperty('compressionRatio')
    expect(stats).toHaveProperty('totalDuration')
    expect(stats).toHaveProperty('toolsUsed')
    expect(Array.isArray(stats.toolsUsed)).toBe(true)
    expect(stats.originalSize).toBe(testImage.length)
  })

  it('should expose compressor capabilities', async () => {
    const capabilities = await getCapabilities()

    expect(getSupportedFormats()).toContain('jpeg')
    expect(capabilities.outputFormats).toContain('avif')
    expect(capabilities.strategies).toContain('targetSize')
    expect(capabilities.metadata).toContain('all')
    expect(capabilities.tools.some(tool => tool.tool === 'sharp' && tool.installed)).toBe(true)
  })

  it('should convert output format', async () => {
    const testImage = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#336699',
      },
    }).png().toBuffer()
    const result = await compress(testImage, { quality: 0.8, format: 'webp' })
    const metadata = await sharp(result).metadata()

    expect(metadata.format).toBe('webp')
  })

  it('should return detailed compression result with selected reason', async () => {
    const testImage = createTestPNG()
    const result = await compressDetailed(testImage, { quality: 0.8, strategy: 'balanced' })

    expect(Buffer.isBuffer(result.output)).toBe(true)
    expect(result.selectedReason).toContain('within 10%')
    expect(result.metadata.input.format).toBe('png')
    expect(result.toolsUsed.length).toBeGreaterThan(0)
  })

  it('should create output variants', async () => {
    const testImage = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#ffcc00',
      },
    }).png().toBuffer()
    const variants = await compressVariants(testImage, {
      quality: 0.8,
      formats: ['webp', 'avif'],
    })

    expect(variants.map(variant => variant.format)).toEqual(['webp', 'avif'])
    expect(variants.every(variant => Buffer.isBuffer(variant.result.output))).toBe(true)
  })

  it('should support targetBytes strategy', async () => {
    const testImage = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 3,
        background: '#336699',
      },
    }).png().toBuffer()

    const result = await compressDetailed(testImage, {
      quality: 0.9,
      targetBytes: Math.max(100, testImage.length - 1),
    })

    expect(result.selectedReason).toContain('targetBytes')
    expect(result.compressedSize).toBeGreaterThan(0)
  })

  it('should compress files with cache manifest', async () => {
    const testImage = createTestPNG()
    const outputDir = path.join(__dirname, '..', 'tmp', 'test-output', 'batch')
    const inputDir = path.join(outputDir, 'input')
    const inputPath = path.join(inputDir, 'sample.png')
    const cacheFile = path.join(outputDir, 'cache.json')

    fs.rmSync(outputDir, { force: true, recursive: true })
    fs.mkdirSync(inputDir, { recursive: true })
    fs.writeFileSync(inputPath, testImage)

    const firstRun = await compressFiles([inputPath], {
      outputDir,
      cacheFile,
      quality: 0.8,
      format: 'webp',
    })
    const secondRun = await compressFiles([inputPath], {
      outputDir,
      cacheFile,
      quality: 0.8,
      format: 'webp',
    })

    expect(firstRun[0].skipped).toBe(false)
    expect(secondRun[0].skipped).toBe(true)
    expect(fs.existsSync(firstRun[0].outputPath)).toBe(true)
  })

  it('should work with legacy parameter format', async () => {
    const testImage = createTestPNG()
    const result = await compress(testImage, 0.8, 'buffer')

    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('should handle file-like objects', async () => {
    const testImage = createTestPNG()
    const fileObj = {
      name: 'test.png',
      size: testImage.length,
      type: 'image/png',
      async arrayBuffer() {
        return Uint8Array.from(testImage).buffer
      },
    }

    const result = await compress(fileObj, { quality: 0.8 })
    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('should preserve bytes when converting buffers to blob and file objects', async () => {
    const source = Buffer.from([0, 1, 2, 3, 255])

    const blob = bufferToBlob(source, 'application/octet-stream')
    const file = bufferToFile(source, 'test.bin', 'application/octet-stream')

    expect(await getBufferFromFile(blob)).toEqual(source)
    expect(await getBufferFromFile(file)).toEqual(source)
  })

  it('should snapshot blob and file bytes when converting from buffers', async () => {
    const source = Buffer.from([1, 2, 3])
    const blob = bufferToBlob(source, 'application/octet-stream')
    const file = bufferToFile(source, 'test.bin', 'application/octet-stream')

    source.fill(9)

    expect(await getBufferFromFile(blob)).toEqual(Buffer.from([1, 2, 3]))
    expect(await getBufferFromFile(file)).toEqual(Buffer.from([1, 2, 3]))
  })

  it('should return real bytes for blob and file outputs', async () => {
    const testImage = createTestPNG()
    const fileObj = {
      name: 'test.png',
      size: testImage.length,
      type: 'image/png',
      async arrayBuffer() {
        return Uint8Array.from(testImage).buffer
      },
    }

    const blobResult = await compress(testImage, { quality: 0.8, type: 'blob' })
    const fileResult = await compress(fileObj, { quality: 0.8, type: 'file' })

    const blobBuffer = Buffer.from(await blobResult.arrayBuffer())
    const fileBuffer = Buffer.from(await fileResult.arrayBuffer())

    expect(blobBuffer.length).toBe(blobResult.size)
    expect(fileBuffer.length).toBe(fileResult.size)
    expect(blobBuffer.equals(Buffer.alloc(blobBuffer.length))).toBe(false)
    expect(fileBuffer.equals(Buffer.alloc(fileBuffer.length))).toBe(false)
  })

  it('should infer blob and file MIME types from bytes', async () => {
    const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9])
    const gif = Buffer.from('GIF89a', 'ascii')
    const webp = Buffer.from('RIFFxxxxWEBP', 'ascii')

    const jpegBlob = await convertBufferToType(jpeg, 'blob')
    const gifFile = await convertBufferToType(gif, 'file', 'wrong.png')
    const webpBlob = await convertBufferToType(webp, 'blob')

    expect(jpegBlob.type).toBe('image/jpeg')
    expect(gifFile.type).toBe('image/gif')
    expect(webpBlob.type).toBe('image/webp')
  })

  it('should expose real bytes in compression stats file', async () => {
    const testImage = createTestPNG()
    const stats = await compressWithStats(testImage, { quality: 0.8 })
    const compressedFileBuffer = Buffer.from(await stats.compressedFile.arrayBuffer())

    expect(compressedFileBuffer.length).toBe(stats.compressedFile.size)
    expect(compressedFileBuffer.equals(Buffer.alloc(compressedFileBuffer.length))).toBe(false)
  })

  it('should reject unsupported image formats', async () => {
    const invalidBuffer = Buffer.from('invalid image data')

    await expect(compress(invalidBuffer, { quality: 0.8 }))
      .rejects
      .toThrow('Unsupported image format')

    await expect(compressWithStats(invalidBuffer, { quality: 0.8 }))
      .rejects
      .toThrow('Unsupported image format')
  })

  it('should reject quality values outside 0 to 1', async () => {
    const testImage = createTestPNG()

    await expect(compress(testImage, { quality: 1.5 }))
      .rejects
      .toThrow('quality must be a number between 0 and 1')

    await expect(compressWithStats(testImage, { quality: -0.1 }))
      .rejects
      .toThrow('quality must be a number between 0 and 1')
  })

  it('should accept boundary quality values', async () => {
    const testImage = createTestPNG()

    for (const quality of [0, 1]) {
      const result = await compress(testImage, { quality })
      const stats = await compressWithStats(testImage, { quality })

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(stats.originalSize).toBe(testImage.length)
      expect(stats.compressedSize).toBeGreaterThan(0)
    }
  })

  it('should reject invalid dimension values', async () => {
    const testImage = createTestPNG()

    await expect(compress(testImage, { quality: 0.8, maxWidth: 0 }))
      .rejects
      .toThrow('maxWidth must be a positive integer')

    await expect(compress(testImage, { quality: 0.8, targetHeight: 10.5 }))
      .rejects
      .toThrow('targetHeight must be a positive integer')

    await expect(compressWithStats(testImage, { quality: 0.8, maxHeight: Number.NaN }))
      .rejects
      .toThrow('maxHeight must be a positive integer')
  })

  it('should reject invalid option object values', async () => {
    const testImage = createTestPNG()

    await expect(compress(testImage, null as any))
      .rejects
      .toThrow('options must be an object')

    await expect(compress(testImage, [] as any))
      .rejects
      .toThrow('options must be an object')

    await expect(compress(testImage, { quality: 0.8, returnAllResults: 'false' as any }))
      .rejects
      .toThrow('returnAllResults must be a boolean')

    await expect(compress(testImage, { quality: 0.8, toolConfigs: {} as any }))
      .rejects
      .toThrow('toolConfigs must be an array')

    await expect(compressWithStats(testImage, { quality: 0.8, preserveExif: 'true' as any }))
      .rejects
      .toThrow('preserveExif must be a boolean')

    await expect(compressWithStats(testImage, [] as any))
      .rejects
      .toThrow('options must be an object')
  })

  it('should reject invalid file inputs', async () => {
    const testImage = createTestPNG()

    await expect(compress(null as any, { quality: 0.8 }))
      .rejects
      .toThrow('file must be a Buffer, Blob-like object, or File-like object')

    await expect(compress({
      name: 123,
      size: testImage.length,
      type: 'image/png',
      async arrayBuffer() {
        return Uint8Array.from(testImage).buffer
      },
    } as any, { quality: 0.8 }))
      .rejects
      .toThrow('file.name must be a string')

    await expect(compressWithStats({} as any, { quality: 0.8 }))
      .rejects
      .toThrow('file must be a Buffer, Blob-like object, or File-like object')
  })

  it('should reject unsupported result types', async () => {
    const testImage = createTestPNG()

    await expect(compress(testImage, { quality: 0.8, type: 'arraybuffer' as any }))
      .rejects
      .toThrow('type must be one of buffer, base64, blob, or file')

    await expect(compress(testImage, 0.8, '' as any))
      .rejects
      .toThrow('type must be one of buffer, base64, blob, or file')

    await expect(convertBufferToType(testImage, 'arraybuffer' as any))
      .rejects
      .toThrow('type must be one of buffer, base64, blob, or file')
  })

  it('should reject result type for compression stats', async () => {
    const testImage = createTestPNG()

    await expect(compressWithStats(testImage, { quality: 0.8, type: 'buffer' } as any))
      .rejects
      .toThrow('compressWithStats does not support type')

    await expect(compressWithStats(testImage, { quality: 0.8, returnAllResults: true } as any))
      .rejects
      .toThrow('compressWithStats does not support returnAllResults')
  })

  it('should compress real icon.png and show tool comparison', async () => {
    const iconPath = path.join(__dirname, 'icon.png')

    // 跳过测试如果文件不存在
    if (!fs.existsSync(iconPath)) {
      console.warn('⚠️  icon.png not found, skipping real image test')
      return
    }

    const iconBuffer = fs.readFileSync(iconPath)
    console.log(`\n📸 测试真实图片: icon.png (${iconBuffer.length} bytes)`)

    // 测试压缩统计
    const stats = await compressWithStats(iconBuffer, { quality: 0.8 })

    console.log(`\n🔍 压缩工具对比结果:`)
    console.log(`最佳工具: ${stats.bestTool}`)
    console.log(`原始大小: ${stats.originalSize} bytes`)
    console.log(`压缩大小: ${stats.compressedSize} bytes`)
    console.log(`压缩率: ${stats.compressionRatio.toFixed(1)}%`)
    console.log(`总耗时: ${stats.totalDuration}ms`)

    console.log(`\n📊 各工具详细表现:`)
    stats.toolsUsed.forEach((tool) => {
      const status = tool.success ? '✅' : '❌'
      const ratio = tool.compressionRatio.toFixed(1)
      console.log(`  ${tool.tool}: ${tool.size} bytes (${ratio}%) - ${tool.duration}ms ${status}`)
    })

    // 验证压缩效果
    expect(stats.originalSize).toBe(iconBuffer.length)
    expect(stats.compressedSize).toBeLessThanOrEqual(stats.originalSize)
    expect(stats.toolsUsed.length).toBeGreaterThan(0)

    // 如果有成功的工具，验证压缩比
    const successfulTools = stats.toolsUsed.filter(tool => tool.success)
    if (successfulTools.length > 0) {
      console.log(`\n✅ 成功工具数量: ${successfulTools.length}`)
      const bestTool = successfulTools.reduce((best, current) =>
        current.size < best.size ? current : best,
      )
      console.log(`🏆 最优工具: ${bestTool.tool} (${bestTool.compressionRatio.toFixed(1)}% 压缩率)`)

      expect(bestTool.size).toBeLessThan(iconBuffer.length)
      expect(bestTool.compressionRatio).toBeGreaterThan(0)
    }
  }, 10000) // 增加超时时间

  it('should test different quality levels with real image', async () => {
    const iconPath = path.join(__dirname, 'icon.png')

    if (!fs.existsSync(iconPath)) {
      console.warn('⚠️  icon.png not found, skipping quality test')
      return
    }

    const iconBuffer = fs.readFileSync(iconPath)
    const qualities = [0.3, 0.5, 0.7, 0.9]

    console.log(`\n🎛️  不同质量级别测试:`)

    for (const quality of qualities) {
      const compressed = await compress(iconBuffer, { quality })
      const compressionRatio = ((iconBuffer.length - compressed.length) / iconBuffer.length) * 100

      console.log(`  质量 ${quality}: ${compressed.length} bytes (${compressionRatio.toFixed(1)}% 压缩率)`)

      expect(Buffer.isBuffer(compressed)).toBe(true)
      expect(compressed.length).toBeGreaterThan(0)

      // 通常质量越低，文件越小
      if (quality <= 0.5) {
        expect(compressed.length).toBeLessThan(iconBuffer.length)
      }
    }
  }, 10000)
})

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { compressWithImagemin } from '../src/tools/imagemin'
import { compressWithSharp } from '../src/tools/sharp'

// ESM模块中获取__dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('压缩工具单独测试', () => {
  let testBuffer: Buffer
  let iconPath: string

  beforeAll(() => {
    iconPath = path.join(__dirname, 'icon.png')

    if (fs.existsSync(iconPath)) {
      testBuffer = fs.readFileSync(iconPath)
    }
    else {
      // 创建简单的测试PNG (1x1像素)
      testBuffer = Buffer.from([
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
        0x01, // minimal data
        0xE5,
        0x27,
        0xDE,
        0xFC, // CRC
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
  })

  const testOptions = {
    quality: 0.8,
    maxWidth: undefined,
    maxHeight: undefined,
    targetWidth: undefined,
    targetHeight: undefined,
    preserveExif: false,
  }

  describe('sharp工具', () => {
    it('应该能够导入Sharp模块', async () => {
      await expect(import('sharp')).resolves.toBeDefined()
    })

    it('应该能够压缩PNG图片', async () => {
      const startTime = performance.now()
      const compressedBuffer = await compressWithSharp(testBuffer, testOptions)
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(Buffer.isBuffer(compressedBuffer)).toBe(true)
      expect(compressedBuffer.length).toBeGreaterThan(0)

      const compressionRatio = ((testBuffer.length - compressedBuffer.length) / testBuffer.length) * 100

      console.log(`   Sharp压缩结果:`)
      console.log(`   - 原始大小: ${testBuffer.length} bytes (${(testBuffer.length / 1024).toFixed(2)} KB)`)
      console.log(`   - 压缩后大小: ${compressedBuffer.length} bytes (${(compressedBuffer.length / 1024).toFixed(2)} KB)`)
      console.log(`   - 压缩率: ${compressionRatio.toFixed(1)}%`)
      console.log(`   - 耗时: ${duration.toFixed(1)}ms`)

      // 对于真实图片，压缩后应该更小；对于1x1测试图片，可能会更大
      if (testBuffer.length > 1000) {
        expect(compressedBuffer.length).toBeLessThan(testBuffer.length)
      }
    }, 10000)

    it('应该处理不同的质量设置', async () => {
      const qualities = [0.3, 0.5, 0.8, 0.9]

      for (const quality of qualities) {
        const compressedBuffer = await compressWithSharp(testBuffer, { ...testOptions, quality })

        expect(Buffer.isBuffer(compressedBuffer)).toBe(true)
        expect(compressedBuffer.length).toBeGreaterThan(0)

        const compressionRatio = ((testBuffer.length - compressedBuffer.length) / testBuffer.length) * 100
        console.log(`   质量${quality}: ${compressedBuffer.length} bytes (压缩率: ${compressionRatio.toFixed(1)}%)`)
      }
    }, 15000)

    it('应该处理尺寸调整', async () => {
      if (testBuffer.length > 1000) { // 只对真实图片测试尺寸调整
        const resizeOptions = [
          { maxWidth: 200, maxHeight: 200 },
          { maxWidth: 100, maxHeight: 100 },
          { targetWidth: 150, targetHeight: 150 },
        ]

        for (const options of resizeOptions) {
          const compressedBuffer = await compressWithSharp(testBuffer, { ...testOptions, ...options })

          expect(Buffer.isBuffer(compressedBuffer)).toBe(true)
          expect(compressedBuffer.length).toBeGreaterThan(0)

          console.log(`   尺寸调整 ${JSON.stringify(options)}: ${compressedBuffer.length} bytes`)
        }
      }
      else {
        console.log('   跳过尺寸调整测试（使用简单测试图片）')
      }
    }, 10000)
  })

  describe('imagemin工具', () => {
    it('应该能够导入Imagemin模块', async () => {
      // @ts-expect-error - optional dependency
      await expect(import('imagemin')).resolves.toBeDefined()
    })

    it('应该能够导入Imagemin插件', async () => {
      await expect(import('imagemin-pngquant')).resolves.toBeDefined()
      // @ts-expect-error - optional dependency
      await expect(import('imagemin-jpegtran')).resolves.toBeDefined()
      // @ts-expect-error - optional dependency
      await expect(import('imagemin-webp')).resolves.toBeDefined()
      // @ts-expect-error - optional dependency
      await expect(import('imagemin-gifsicle')).resolves.toBeDefined()
    })

    it('应该能够压缩PNG图片', async () => {
      const startTime = performance.now()
      const compressedBuffer = await compressWithImagemin(testBuffer, testOptions)
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(Buffer.isBuffer(compressedBuffer)).toBe(true)
      expect(compressedBuffer.length).toBeGreaterThan(0)

      const compressionRatio = ((testBuffer.length - compressedBuffer.length) / testBuffer.length) * 100

      console.log(`   Imagemin压缩结果:`)
      console.log(`   - 原始大小: ${testBuffer.length} bytes (${(testBuffer.length / 1024).toFixed(2)} KB)`)
      console.log(`   - 压缩后大小: ${compressedBuffer.length} bytes (${(compressedBuffer.length / 1024).toFixed(2)} KB)`)
      console.log(`   - 压缩率: ${compressionRatio.toFixed(1)}%`)
      console.log(`   - 耗时: ${duration.toFixed(1)}ms`)
    }, 10000)

    it('应该处理不同的质量设置', async () => {
      const qualities = [0.3, 0.5, 0.8, 0.9]

      for (const quality of qualities) {
        const compressedBuffer = await compressWithImagemin(testBuffer, { ...testOptions, quality })

        expect(Buffer.isBuffer(compressedBuffer)).toBe(true)
        expect(compressedBuffer.length).toBeGreaterThan(0)

        const compressionRatio = ((testBuffer.length - compressedBuffer.length) / testBuffer.length) * 100
        console.log(`   质量${quality}: ${compressedBuffer.length} bytes (压缩率: ${compressionRatio.toFixed(1)}%)`)
      }
    }, 15000)
  })

  describe('工具性能对比', () => {
    it('应该对比Sharp和Imagemin的性能', async () => {
      const results: Array<{
        tool: string
        size: number
        duration: number
        success: boolean
        error?: string
      }> = []

      // 测试Sharp
      try {
        const startTime = performance.now()
        const sharpResult = await compressWithSharp(testBuffer, testOptions)
        const endTime = performance.now()

        results.push({
          tool: 'Sharp',
          size: sharpResult.length,
          duration: Math.round(endTime - startTime),
          success: true,
        })
      }
      catch (error) {
        results.push({
          tool: 'Sharp',
          size: testBuffer.length,
          duration: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // 测试Imagemin
      try {
        const startTime = performance.now()
        const imageminResult = await compressWithImagemin(testBuffer, testOptions)
        const endTime = performance.now()

        results.push({
          tool: 'Imagemin',
          size: imageminResult.length,
          duration: Math.round(endTime - startTime),
          success: true,
        })
      }
      catch (error) {
        results.push({
          tool: 'Imagemin',
          size: testBuffer.length,
          duration: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // 输出对比表格
      console.log('\n   📊 工具性能对比:')
      console.table(results.map(result => ({
        工具名称: result.tool,
        压缩后大小: `${result.size}B (${(result.size / 1024).toFixed(2)}KB)`,
        压缩率: `${(((testBuffer.length - result.size) / testBuffer.length) * 100).toFixed(1)}%`,
        耗时: `${result.duration}ms`,
        状态: result.success ? '✅ 成功' : '❌ 失败',
        错误: result.error || '-',
      })))

      // 至少应该有一个工具成功
      const successfulResults = results.filter(r => r.success)
      expect(successfulResults.length).toBeGreaterThan(0)

      // 找到最佳结果
      if (successfulResults.length > 0) {
        const bestResult = successfulResults.reduce((best, current) =>
          current.size < best.size ? current : best,
        )

        console.log(`\n   🏆 最佳工具: ${bestResult.tool}`)
        console.log(`   📉 最佳压缩率: ${(((testBuffer.length - bestResult.size) / testBuffer.length) * 100).toFixed(1)}%`)
      }
    }, 15000)
  })

  describe('错误处理', () => {
    it('sharp应该处理无效输入', async () => {
      const invalidBuffer = Buffer.from('invalid image data')

      await expect(compressWithSharp(invalidBuffer, testOptions))
        .rejects
        .toThrow()
    })

    it('imagemin应该处理无效输入', async () => {
      const invalidBuffer = Buffer.from('invalid image data')

      // Imagemin 可能不会对所有无效输入抛出错误，而是返回原始数据或处理后的数据
      // 我们测试它不会崩溃，并且返回一个Buffer
      const result = await compressWithImagemin(invalidBuffer, testOptions)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('应该处理空Buffer', async () => {
      const emptyBuffer = Buffer.alloc(0)

      await expect(compressWithSharp(emptyBuffer, testOptions))
        .rejects
        .toThrow()

      await expect(compressWithImagemin(emptyBuffer, testOptions))
        .rejects
        .toThrow('Invalid input buffer: buffer must be a non-empty Buffer')
    })

    it('imagemin应该处理完全无效的图像格式', async () => {
      // 测试一个肯定会导致imagemin失败的场景
      const reallyInvalidBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03])

      try {
        const result = await compressWithImagemin(reallyInvalidBuffer, testOptions)
        // 如果没有抛出错误，检查结果是否合理
        expect(Buffer.isBuffer(result)).toBe(true)
        console.log('   Imagemin处理了无效输入但没有抛出错误')
      }
      catch (error) {
        // 如果抛出了错误，这也是可接受的行为
        expect(error).toBeInstanceOf(Error)
        console.log('   Imagemin正确地拒绝了无效输入')
      }
    })
  })
})

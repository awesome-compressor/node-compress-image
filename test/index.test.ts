import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compress, compressWithStats } from '../src/index'

// ESM模块中获取__dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('node-image-compression', () => {
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
        return new ArrayBuffer(testImage.byteLength)
      },
    }

    const result = await compress(fileObj, { quality: 0.8 })
    expect(Buffer.isBuffer(result)).toBe(true)
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

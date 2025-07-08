import { describe, expect, it } from 'vitest'
import { compress, compressWithStats } from '../../src/index'
import { createTestJPEG, createTestPNG, getTestImage, saveTestResult } from '../helpers'

describe('集成测试 - 所有工具协同工作', () => {
  it('应该能够使用自动工具选择压缩图像', async () => {
    const testBuffer = getTestImage()

    const result = await compress(testBuffer, {
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080,
    })

    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)

    // 保存结果
    saveTestResult('integration_auto_selection.png', result)
  })

  it('应该能够返回多个工具的压缩结果', async () => {
    const testBuffer = createTestPNG()

    const results = await compress(testBuffer, {
      quality: 0.8,
      returnAllResults: true,
    })

    expect(results).toHaveProperty('bestTool')
    expect(results).toHaveProperty('bestResult')
    expect(results).toHaveProperty('allResults')
    expect(results).toHaveProperty('totalDuration')

    expect(Array.isArray(results.allResults)).toBe(true)
    expect(results.allResults.length).toBeGreaterThan(0)
    expect(results.totalDuration).toBeGreaterThan(0)

    console.log(`最佳工具: ${results.bestTool}`)
    console.log(`测试了 ${results.allResults.length} 个工具`)
    console.log(`总耗时: ${results.totalDuration}ms`)
  })

  it('应该能够使用统计信息功能', async () => {
    const testBuffer = createTestJPEG()

    const stats = await compressWithStats(testBuffer, {
      quality: 0.8,
      maxWidth: 1000,
    })

    expect(stats).toHaveProperty('bestTool')
    expect(stats).toHaveProperty('compressedFile')
    expect(stats).toHaveProperty('originalSize')
    expect(stats).toHaveProperty('compressedSize')
    expect(stats).toHaveProperty('compressionRatio')
    expect(stats).toHaveProperty('totalDuration')
    expect(stats).toHaveProperty('toolsUsed')

    expect(Array.isArray(stats.toolsUsed)).toBe(true)
    expect(stats.toolsUsed.length).toBeGreaterThan(0)
    expect(stats.originalSize).toBe(testBuffer.length)
    expect(stats.compressedSize).toBeGreaterThan(0)
    expect(stats.totalDuration).toBeGreaterThan(0)

    console.log(`统计信息:`)
    console.log(`  最佳工具: ${stats.bestTool}`)
    console.log(`  原始大小: ${stats.originalSize} bytes`)
    console.log(`  压缩大小: ${stats.compressedSize} bytes`)
    console.log(`  压缩率: ${stats.compressionRatio.toFixed(2)}%`)
    console.log(`  总耗时: ${stats.totalDuration}ms`)
    console.log(`  测试工具数: ${stats.toolsUsed.length}`)
  })

  it('应该能够处理不同的输出格式', async () => {
    const testBuffer = createTestPNG()

    // Buffer 格式
    const bufferResult = await compress(testBuffer, {
      quality: 0.8,
      type: 'buffer',
    })
    expect(Buffer.isBuffer(bufferResult)).toBe(true)

    // Base64 格式
    const base64Result = await compress(testBuffer, {
      quality: 0.8,
      type: 'base64',
    })
    expect(typeof base64Result).toBe('string')
    expect(base64Result.length).toBeGreaterThan(0)

    // Blob 格式
    const blobResult = await compress(testBuffer, {
      quality: 0.8,
      type: 'blob',
    })
    expect(blobResult).toHaveProperty('size')
    expect(blobResult).toHaveProperty('type')
    expect(blobResult).toHaveProperty('arrayBuffer')
    expect(blobResult.size).toBeGreaterThan(0)
  })

  it('应该能够处理不同的压缩模式', async () => {
    const testBuffer = createTestJPEG()

    // keepQuality 模式
    const qualityResult = await compress(testBuffer, {
      quality: 0.9,
      mode: 'keepQuality',
    })
    expect(Buffer.isBuffer(qualityResult)).toBe(true)

    // keepSize 模式
    const sizeResult = await compress(testBuffer, {
      quality: 0.8,
      mode: 'keepSize',
    })
    expect(Buffer.isBuffer(sizeResult)).toBe(true)

    // 保存结果进行对比
    saveTestResult('integration_keep_quality.jpg', qualityResult)
    saveTestResult('integration_keep_size.jpg', sizeResult)
  })

  it('应该能够处理不同的尺寸选项', async () => {
    const testBuffer = getTestImage()

    // 目标尺寸
    const targetResult = await compress(testBuffer, {
      quality: 0.8,
      targetWidth: 100,
      targetHeight: 100,
    })
    expect(Buffer.isBuffer(targetResult)).toBe(true)
    saveTestResult('integration_target_size.png', targetResult)

    // 最大尺寸
    const maxResult = await compress(testBuffer, {
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
    })
    expect(Buffer.isBuffer(maxResult)).toBe(true)
    saveTestResult('integration_max_size.png', maxResult)
  })

  it('应该能够处理EXIF保留选项', async () => {
    const testBuffer = createTestJPEG()

    // 保留EXIF
    const preserveExifResult = await compress(testBuffer, {
      quality: 0.8,
      preserveExif: true,
    })
    expect(Buffer.isBuffer(preserveExifResult)).toBe(true)
    saveTestResult('integration_preserve_exif.jpg', preserveExifResult)

    // 不保留EXIF
    const stripExifResult = await compress(testBuffer, {
      quality: 0.8,
      preserveExif: false,
    })
    expect(Buffer.isBuffer(stripExifResult)).toBe(true)
    saveTestResult('integration_strip_exif.jpg', stripExifResult)
  })

  it('应该正确处理错误情况', async () => {
    // 空Buffer
    const emptyBuffer = Buffer.alloc(0)
    await expect((await compress(emptyBuffer, { quality: 0.8 })).length)
      .toBe(0)

    // 无效质量参数
    const testBuffer = createTestPNG()
    const result = await compress(testBuffer, { quality: 1.5 })
    // 应该能处理超出范围的质量值，不应该抛出错误
    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('应该在开发模式下显示详细日志', async () => {
    // 临时设置开发环境
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    try {
      const testBuffer = createTestPNG()
      const results = await compress(testBuffer, {
        quality: 0.8,
        returnAllResults: true,
      })

      expect(results.allResults.length).toBeGreaterThan(0)
    }
    finally {
      // 恢复原始环境变量
      process.env.NODE_ENV = originalEnv
    }
  })
})

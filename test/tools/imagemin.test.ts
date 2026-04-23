import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { compressWithImagemin } from '../../src/tools/imagemin'
import { defaultOptions, getTestJPEG, getTestPNG, isValidBuffer, saveTestResult } from '../helpers'

describe('imageMin 压缩工具测试', () => {
  it('应该能够压缩PNG图像', async () => {
    const testBuffer = getTestPNG()
    const result = await compressWithImagemin(testBuffer, defaultOptions)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('imagemin_png_test.png', result)
  })

  it('应该能够压缩JPEG图像', async () => {
    const testBuffer = getTestJPEG()
    const result = await compressWithImagemin(testBuffer, defaultOptions)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('imagemin_jpeg_test.jpg', result)
  })

  it('应该能够处理不同的质量设置', async () => {
    const testBuffer = getTestJPEG()

    for (const quality of [0.3, 0.5, 0.8, 0.9]) {
      const options = { ...defaultOptions, quality }
      const result = await compressWithImagemin(testBuffer, options)

      expect(isValidBuffer(result)).toBe(true)
      expect(result).toBeInstanceOf(Buffer)

      // 保存测试结果
      saveTestResult(`imagemin_quality_${quality}_test.jpg`, result)
    }
  })

  it('应该正确处理无效输入', async () => {
    const emptyBuffer = Buffer.alloc(0)

    await expect(compressWithImagemin(emptyBuffer, defaultOptions))
      .rejects
      .toThrow('Invalid input buffer')
  })

  it('应该拒绝未识别的图像格式', async () => {
    const invalidBuffer = Buffer.from('invalid image data')

    await expect(compressWithImagemin(invalidBuffer, defaultOptions))
      .rejects
      .toThrow('Unsupported image format')
  })

  it('应该正确处理无效质量参数', async () => {
    const testBuffer = getTestPNG()
    const invalidOptions = { ...defaultOptions, quality: -0.5 }

    await expect(compressWithImagemin(testBuffer, invalidOptions))
      .rejects
      .toThrow('Invalid quality value')
  })

  it('应该正确处理超出范围的质量参数', async () => {
    const testBuffer = getTestPNG()
    const invalidOptions = { ...defaultOptions, quality: 1.5 }

    await expect(compressWithImagemin(testBuffer, invalidOptions))
      .rejects
      .toThrow('Invalid quality value')
  })

  it('应该能够处理WebP格式', async () => {
    const testBuffer = await sharp(getTestPNG()).webp({ quality: 80 }).toBuffer()
    const result = await compressWithImagemin(testBuffer, defaultOptions)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)
    const metadata = await sharp(result).metadata()
    expect(metadata.format).toBe('webp')

    // 保存测试结果
    saveTestResult('imagemin_webp_test.webp', result)
  })
})

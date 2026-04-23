import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { compressWithSharp } from '../../src/tools/sharp'
import { defaultOptions, getTestGIF, getTestJPEG, getTestPNG, isValidBuffer, saveTestResult } from '../helpers'

describe('sharp 压缩工具测试', () => {
  it('应该能够压缩PNG图像', async () => {
    const testBuffer = getTestPNG()
    const result = await compressWithSharp(testBuffer, defaultOptions)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('sharp_png_test.png', result)
  })

  it('应该能够压缩JPEG图像', async () => {
    const testBuffer = getTestJPEG()
    const result = await compressWithSharp(testBuffer, defaultOptions)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('sharp_jpeg_test.jpg', result)
  })

  it('应该能够处理GIF图像', async () => {
    const testBuffer = getTestGIF()
    const result = await compressWithSharp(testBuffer, defaultOptions)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('sharp_gif_test.gif', result)
  })

  it('应该能够调整图片尺寸', async () => {
    const testBuffer = getTestPNG()
    const options = {
      ...defaultOptions,
      targetWidth: 100,
      targetHeight: 100,
    }

    const result = await compressWithSharp(testBuffer, options)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('sharp_resize_test.png', result)
  })

  it('应该能够设置最大尺寸', async () => {
    const testBuffer = getTestPNG()
    const options = {
      ...defaultOptions,
      maxWidth: 500,
      maxHeight: 500,
    }

    const result = await compressWithSharp(testBuffer, options)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('sharp_max_size_test.png', result)
  })

  it('应该能够处理不同的质量设置', async () => {
    const testBuffer = getTestJPEG()

    for (const quality of [0.3, 0.5, 0.8, 0.9]) {
      const options = { ...defaultOptions, quality }
      const result = await compressWithSharp(testBuffer, options)

      expect(isValidBuffer(result)).toBe(true)
      expect(result).toBeInstanceOf(Buffer)

      // 保存测试结果
      saveTestResult(`sharp_quality_${quality}_test.jpg`, result)
    }
  })

  it('应该在 preserveExif 为 true 时保留EXIF', async () => {
    const testBuffer = getTestPNG()
    const inputMetadata = await sharp(testBuffer).metadata()
    expect(inputMetadata.exif?.length).toBeGreaterThan(0)

    const withExif = await compressWithSharp(testBuffer, { ...defaultOptions, preserveExif: true })
    const withoutExif = await compressWithSharp(testBuffer, { ...defaultOptions, preserveExif: false })

    const withExifMetadata = await sharp(withExif).metadata()
    const withoutExifMetadata = await sharp(withoutExif).metadata()

    expect(withExifMetadata.exif?.length).toBeGreaterThan(0)
    expect(withoutExifMetadata.exif).toBeUndefined()
  })

  it('应该保持PNG输出格式', async () => {
    const testBuffer = getTestPNG()
    const result = await compressWithSharp(testBuffer, defaultOptions)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)
    const metadata = await sharp(result).metadata()
    expect(metadata.format).toBe('png')
  })

  it('应该拒绝Sharp工具未支持的图片格式', async () => {
    const tiffBuffer = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: 'red',
      },
    }).tiff().toBuffer()

    await expect(compressWithSharp(tiffBuffer, defaultOptions))
      .rejects
      .toThrow('Unsupported image format')
  })

  it('应该正确处理无效输入', async () => {
    const emptyBuffer = Buffer.alloc(0)

    await expect(compressWithSharp(emptyBuffer, defaultOptions))
      .rejects
      .toThrow()
  })

  it('应该正确处理无效质量参数', async () => {
    const testBuffer = getTestPNG()
    const invalidOptions = { ...defaultOptions, quality: 1.5 }

    // Sharp应该能处理超出范围的质量值
    const result = await compressWithSharp(testBuffer, invalidOptions)
    expect(isValidBuffer(result)).toBe(true)
  })
})

import { beforeAll, describe, expect, it } from 'vitest'
import { compressWithJimp } from '../../src/tools/jimp'
import { defaultOptions, getTestJPEG, getTestPNG, isToolAvailable, isValidBuffer, saveTestResult } from '../helpers'

describe('jIMP 压缩工具测试', () => {
  let isJimpAvailable = false

  beforeAll(async () => {
    isJimpAvailable = await isToolAvailable('jimp')
  })

  it('应该能够压缩PNG图像', async () => {
    if (!isJimpAvailable) {
      console.warn('JIMP 不可用，跳过测试')
      return
    }

    const testBuffer = getTestPNG()
    const result = await compressWithJimp(testBuffer, defaultOptions)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('jimp_png_test.png', result)
  })

  it('应该能够压缩JPEG图像', async () => {
    if (!isJimpAvailable) {
      console.warn('JIMP 不可用，跳过测试')
      return
    }

    const testBuffer = getTestJPEG()
    const result = await compressWithJimp(testBuffer, defaultOptions)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('jimp_jpeg_test.jpg', result)
  })

  it('应该能够调整图片尺寸', async () => {
    if (!isJimpAvailable) {
      console.warn('JIMP 不可用，跳过测试')
      return
    }

    const testBuffer = getTestPNG()
    const options = {
      ...defaultOptions,
      targetWidth: 100,
      targetHeight: 100,
    }

    const result = await compressWithJimp(testBuffer, options)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('jimp_resize_test.png', result)
  })

  it('应该能够设置最大尺寸', async () => {
    if (!isJimpAvailable) {
      console.warn('JIMP 不可用，跳过测试')
      return
    }

    const testBuffer = getTestPNG()
    const options = {
      ...defaultOptions,
      maxWidth: 500,
      maxHeight: 500,
    }

    const result = await compressWithJimp(testBuffer, options)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('jimp_max_size_test.png', result)
  })

  it('应该能够处理不同的质量设置', async () => {
    if (!isJimpAvailable) {
      console.warn('JIMP 不可用，跳过测试')
      return
    }

    const testBuffer = getTestJPEG()

    for (const quality of [0.3, 0.5, 0.8, 0.9]) {
      const options = { ...defaultOptions, quality }
      const result = await compressWithJimp(testBuffer, options)

      expect(isValidBuffer(result)).toBe(true)
      expect(result).toBeInstanceOf(Buffer)

      // 保存测试结果
      saveTestResult(`jimp_quality_${quality}_test.jpg`, result)
    }
  })

  it('应该正确处理无效输入', async () => {
    if (!isJimpAvailable) {
      console.warn('JIMP 不可用，跳过测试')
      return
    }

    const emptyBuffer = Buffer.alloc(0)

    await expect(compressWithJimp(emptyBuffer, defaultOptions))
      .rejects
      .toThrow('Invalid input buffer')
  })

  it('当JIMP不可用时应该提供友好的错误信息', async () => {
    if (isJimpAvailable) {
      // 如果JIMP可用，跳过此测试
      return
    }

    const testBuffer = getTestPNG()

    await expect(compressWithJimp(testBuffer, defaultOptions))
      .rejects
      .toThrow(/JIMP.*not properly loaded|JIMP.*compression failed/)
  })
})

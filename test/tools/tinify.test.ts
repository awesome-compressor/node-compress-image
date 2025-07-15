import process from 'node:process'
import { beforeAll, describe, expect, it } from 'vitest'
import { compressWithTinify } from '../../src/tools/tinify'
import { defaultOptions, getTestJPEG, getTestPNG, isToolAvailable, isValidBuffer, saveTestResult } from '../helpers'

describe('tinify 压缩工具测试', () => {
  let isTinifyAvailable = false

  beforeAll(async () => {
    isTinifyAvailable = await isToolAvailable('tinify')
  })

  it('应该能够压缩PNG图像', async () => {
    if (!isTinifyAvailable) {
      console.warn('Tinify 不可用或缺少API Key，跳过测试')
      return
    }

    const testBuffer = getTestPNG()
    const options = {
      ...defaultOptions,
      toolConfigs: [
        {
          name: 'tinify',
          key: process.env.TINIFY_API_KEY,
        },
      ],
    }
    const result = await compressWithTinify(testBuffer, options)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('tinify_png_test.png', result)
  })

  it('应该能够压缩JPEG图像', async () => {
    if (!isTinifyAvailable) {
      console.warn('Tinify 不可用或缺少API Key，跳过测试')
      return
    }

    const testBuffer = getTestJPEG()
    const options = {
      ...defaultOptions,
      toolConfigs: [
        {
          name: 'tinify',
          key: process.env.TINIFY_API_KEY,
        },
      ],
    }
    const result = await compressWithTinify(testBuffer, options)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('tinify_jpeg_test.jpg', result)
  })

  it('应该支持不同的质量设置', async () => {
    if (!isTinifyAvailable) {
      console.warn('Tinify 不可用或缺少API Key，跳过测试')
      return
    }

    const testBuffer = getTestJPEG()
    const qualities = [0.3, 0.5, 0.8, 0.9]

    for (const quality of qualities) {
      const options = {
        quality,
        toolConfigs: [
          {
            name: 'tinify',
            key: process.env.TINIFY_API_KEY,
          },
        ],
      }
      const result = await compressWithTinify(testBuffer, options)

      expect(isValidBuffer(result)).toBe(true)
      expect(result).toBeInstanceOf(Buffer)

      // 保存测试结果
      saveTestResult(`tinify_quality_${quality}_test.jpg`, result)
    }
  })

  it('应该支持尺寸调整', async () => {
    if (!isTinifyAvailable) {
      console.warn('Tinify 不可用或缺少API Key，跳过测试')
      return
    }

    const testBuffer = getTestPNG()
    const options = {
      maxWidth: 100,
      maxHeight: 100,
      toolConfigs: [
        {
          name: 'tinify',
          key: process.env.TINIFY_API_KEY,
        },
      ],
    }
    const result = await compressWithTinify(testBuffer, options)

    expect(isValidBuffer(result)).toBe(true)
    expect(result).toBeInstanceOf(Buffer)

    // 保存测试结果
    saveTestResult('tinify_resize_test.png', result)
  })

  it('当没有API Key时应该抛出错误', async () => {
    const testBuffer = getTestPNG()

    // 测试没有提供任何API Key的情况
    await expect(compressWithTinify(testBuffer, defaultOptions)).rejects.toThrow('Tinify API key is required')

    // 测试提供空的toolConfigs
    await expect(compressWithTinify(testBuffer, { toolConfigs: [] })).rejects.toThrow('Tinify API key is required')

    // 测试提供tinify配置但没有key
    await expect(compressWithTinify(testBuffer, {
      toolConfigs: [
        { name: 'tinify' },
      ],
    })).rejects.toThrow('Tinify API key is required')
  })

  it('处理无效输入时应该抛出错误', async () => {
    if (!isTinifyAvailable) {
      console.warn('Tinify 不可用或缺少API Key，跳过测试')
      return
    }

    const options = {
      toolConfigs: [
        {
          name: 'tinify',
          key: process.env.TINIFY_API_KEY,
        },
      ],
    }

    await expect(compressWithTinify(Buffer.alloc(0), options)).rejects.toThrow('Input buffer is empty or invalid')
  })
})

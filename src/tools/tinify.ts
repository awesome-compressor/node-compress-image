import type { CompressOptions } from '../types'
import process from 'node:process'

// Tinify压缩工具
export async function compressWithTinify(
  buffer: Buffer,
  options: CompressOptions,
): Promise<Buffer> {
  try {
    // 验证输入buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Input buffer is empty or invalid')
    }
    // 获取API Key - 优先从options中获取，其次从环境变量
    const tinifyConfig = options.toolConfigs?.find(config => config.name === 'tinify')
    const apiKey = tinifyConfig?.key || process.env.TINIFY_API_KEY

    if (!apiKey) {
      return Promise.reject(new Error('Tinify API key is required. Please set TINIFY_API_KEY environment variable or provide it in toolConfigs.'))
    }

    // 动态导入tinify模块
    const tinify = await import('tinify')

    // 设置API Key
    tinify.default.key = apiKey

    // 从buffer创建source
    const source = tinify.default.fromBuffer(buffer)

    // 处理尺寸调整
    let processedSource = source

    if (options.targetWidth || options.targetHeight || options.maxWidth || options.maxHeight) {
      const resizeOptions: any = {
        method: 'fit', // 保持宽高比
      }

      if (options.targetWidth && options.targetHeight) {
        resizeOptions.width = options.targetWidth
        resizeOptions.height = options.targetHeight
      }
      else if (options.maxWidth || options.maxHeight) {
        if (options.maxWidth)
          resizeOptions.width = options.maxWidth
        if (options.maxHeight)
          resizeOptions.height = options.maxHeight
      }
      else if (options.targetWidth) {
        resizeOptions.width = options.targetWidth
      }
      else if (options.targetHeight) {
        resizeOptions.height = options.targetHeight
      }

      processedSource = source.resize(resizeOptions)
    }

    // 转换为buffer
    const result = await new Promise<Buffer>((resolve, reject) => {
      processedSource.toBuffer((err: any, resultData: any) => {
        if (err) {
          reject(err)
        }
        else {
          resolve(Buffer.from(resultData))
        }
      })
    })

    // 如果压缩后文件大于或接近原文件大小，返回原文件
    // 使用 98% 阈值，避免微小的压缩效果
    if (result.length >= buffer.length * 0.98) {
      return buffer
    }

    return result
  }
  catch (error) {
    throw new Error(`Tinify compression failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

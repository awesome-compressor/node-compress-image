import type { CompressOptions } from '../types'

// JIMP压缩工具
export async function compressWithJimp(
  buffer: Buffer,
  options: CompressOptions,
): Promise<Buffer> {
  try {
    // 验证输入参数
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('Invalid input buffer: buffer must be a non-empty Buffer')
    }

    const Jimp = await import('jimp')

    if (!Jimp?.default?.read) {
      throw new Error('Jimp module not properly loaded or missing read method')
    }

    // 从buffer读取图片
    const image = await Jimp.default.read(buffer)

    // 设置尺寸
    if (options.targetWidth || options.targetHeight) {
      const width = options.targetWidth || Jimp.default.AUTO
      const height = options.targetHeight || Jimp.default.AUTO
      image.resize(width, height)
    }
    else if (options.maxWidth || options.maxHeight) {
      const currentWidth = image.getWidth()
      const currentHeight = image.getHeight()

      let newWidth = currentWidth
      let newHeight = currentHeight

      if (options.maxWidth && currentWidth > options.maxWidth) {
        newWidth = options.maxWidth
        newHeight = (currentHeight * options.maxWidth) / currentWidth
      }

      if (options.maxHeight && newHeight > options.maxHeight) {
        newHeight = options.maxHeight
        newWidth = (currentWidth * options.maxHeight) / currentHeight
      }

      if (newWidth !== currentWidth || newHeight !== currentHeight) {
        image.resize(Math.round(newWidth), Math.round(newHeight))
      }
    }

    // 设置质量
    const quality = Math.round((options.quality || 0.8) * 100)
    if (quality >= 0 && quality <= 100) {
      image.quality(quality)
    }

    // 转换为buffer
    const outputBuffer = await image.getBufferAsync(image.getMIME())

    if (!Buffer.isBuffer(outputBuffer) || outputBuffer.length === 0) {
      throw new Error('Failed to generate output buffer from Jimp')
    }

    // 如果压缩后文件大于或接近原文件大小，返回原文件
    // 使用 98% 阈值，避免微小的压缩效果
    if (outputBuffer.length >= buffer.length * 0.98) {
      return buffer
    }

    return outputBuffer
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Jimp compression failed: ${error.message}`)
    }
    throw new Error(`Jimp compression failed: ${String(error)}`)
  }
}

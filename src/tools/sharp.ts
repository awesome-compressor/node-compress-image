import type { CompressOptions } from '../types'
import sharp from 'sharp'

// Sharp压缩工具
export async function compressWithSharp(
  buffer: Buffer,
  options: CompressOptions,
): Promise<Buffer> {
  try {
    // 验证输入buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Input buffer is empty or invalid')
    }

    let processor = sharp(buffer)

    // 设置尺寸
    if (options.targetWidth || options.targetHeight) {
      processor = processor.resize(options.targetWidth, options.targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
    else if (options.maxWidth || options.maxHeight) {
      processor = processor.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    // 获取图片元数据，添加错误处理
    let metadata
    try {
      metadata = await processor.metadata()
    }
    catch (metadataError) {
      throw new Error(`Failed to read image metadata: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`)
    }

    const format = metadata.format

    // 根据格式进行压缩
    switch (format) {
      case 'jpeg':
        processor = processor.jpeg({
          quality: Math.min(100, Math.max(1, Math.round((options.quality || 0.6) * 100))),
          mozjpeg: true,
        })
        break
      case 'png':
        processor = processor.png({
          quality: Math.min(100, Math.max(1, Math.round((options.quality || 0.6) * 100))),
          compressionLevel: 9,
        })
        break
      case 'webp':
        processor = processor.webp({
          quality: Math.min(100, Math.max(1, Math.round((options.quality || 0.6) * 100))),
        })
        break
      case 'gif':
        // Sharp对GIF支持有限，直接返回原buffer
        return buffer
      default:
        // 默认转为JPEG
        processor = processor.jpeg({
          quality: Math.min(100, Math.max(1, Math.round((options.quality || 0.6) * 100))),
        })
    }

    const result = await processor.toBuffer()

    // 如果压缩后文件大于或接近原文件大小，返回原文件
    // 使用 98% 阈值，避免微小的压缩效果
    if (result.length >= buffer.length * 0.98) {
      return buffer
    }

    return result
  }
  catch (error) {
    throw new Error(`Sharp compression failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

import type { CompressOptions } from '../types'
import sharp from 'sharp'

// Sharp压缩工具
export async function compressWithSharp(
  buffer: Buffer,
  options: CompressOptions,
): Promise<Buffer> {
  try {
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

    // 获取图片元数据
    const metadata = await processor.metadata()
    const format = metadata.format

    // 根据格式进行压缩
    switch (format) {
      case 'jpeg':
        processor = processor.jpeg({
          quality: Math.round((options.quality || 0.6) * 100),
          mozjpeg: true,
        })
        break
      case 'png':
        processor = processor.png({
          quality: Math.round((options.quality || 0.6) * 100),
          compressionLevel: 9,
        })
        break
      case 'webp':
        processor = processor.webp({
          quality: Math.round((options.quality || 0.6) * 100),
        })
        break
      case 'gif':
        // Sharp对GIF支持有限，直接返回原buffer
        return buffer
      default:
        // 默认转为JPEG
        processor = processor.jpeg({
          quality: Math.round((options.quality || 0.6) * 100),
        })
    }

    return await processor.toBuffer()
  }
  catch (error) {
    throw new Error(`Sharp compression failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

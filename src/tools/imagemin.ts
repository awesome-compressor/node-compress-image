import type { CompressOptions } from '../types'

// Imagemin压缩工具
export async function compressWithImagemin(
  buffer: Buffer,
  options: CompressOptions,
): Promise<Buffer> {
  try {
    // 验证输入参数
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('Invalid input buffer: buffer must be a non-empty Buffer')
    }

    // @ts-expect-error - optional dependency
    const imagemin = await import('imagemin')

    if (!imagemin?.default?.buffer) {
      throw new Error('Imagemin module not properly loaded or missing buffer method')
    }

    const quality = Math.round((options.quality || 0.6) * 100)

    // 验证质量参数
    if (quality < 0 || quality > 100) {
      throw new Error(`Invalid quality value: ${quality}. Quality must be between 0 and 100`)
    }

    // 检测图片类型
    const imageType = getImageType(buffer)

    let plugins: any[] = []

    try {
      switch (imageType) {
        case 'image/jpeg':
        case 'image/jpg': {
          // @ts-expect-error - optional dependency
          const imageminJpegtran = await import('imagemin-jpegtran')
          if (!imageminJpegtran?.default) {
            throw new Error('imagemin-jpegtran plugin not available')
          }
          plugins = [
            imageminJpegtran.default({
              quality,
              progressive: true,
            }),
          ]
          break
        }
        case 'image/png': {
          const imageminPngquant = await import('imagemin-pngquant')
          if (!imageminPngquant?.default) {
            throw new Error('imagemin-pngquant plugin not available')
          }
          plugins = [
            imageminPngquant.default({
              quality: [quality / 100, quality / 100],
            }),
          ]
          break
        }
        case 'image/webp': {
          // @ts-expect-error - optional dependency
          const imageminWebp = await import('imagemin-webp')
          if (!imageminWebp?.default) {
            throw new Error('imagemin-webp plugin not available')
          }
          plugins = [
            imageminWebp.default({
              quality,
            }),
          ]
          break
        }
        case 'image/gif': {
          // @ts-expect-error - optional dependency
          const imageminGifsicle = await import('imagemin-gifsicle')
          if (!imageminGifsicle?.default) {
            throw new Error('imagemin-gifsicle plugin not available')
          }
          plugins = [
            imageminGifsicle.default({
              optimizationLevel: 3,
              colors: Math.min(256, Math.max(16, Math.round(quality * 2.56))),
            }),
          ]
          break
        }
        default:
          throw new Error(`Unsupported image type: ${imageType}. Imagemin supports JPEG, PNG, WebP, and GIF formats`)
      }
    }
    catch (pluginError) {
      // 如果插件导入失败，提供更具体的错误信息
      const errorMessage = pluginError instanceof Error ? pluginError.message : String(pluginError)
      throw new Error(`Failed to load Imagemin plugin for ${imageType}: ${errorMessage}. Please install the required imagemin plugin package`)
    }

    if (!plugins || plugins.length === 0) {
      throw new Error(`No valid plugins available for image type: ${imageType}`)
    }

    // 执行压缩
    const result = await imagemin.default.buffer(buffer, {
      plugins,
    })

    // 验证压缩结果
    if (!Buffer.isBuffer(result)) {
      throw new TypeError('Imagemin compression returned invalid result (not a Buffer)')
    }

    if (result.length === 0) {
      throw new Error('Imagemin compression returned empty buffer')
    }

    return result
  }
  catch (error) {
    // 改进错误处理，提供更详细的错误信息
    if (error instanceof Error) {
      // 如果是我们已经处理过的错误，直接重新抛出
      if (error.message.includes('Imagemin compression failed:')) {
        throw error
      }

      // 针对不同类型的错误提供更具体的信息
      if (error.message.includes('Cannot resolve module')) {
        throw new Error(`Imagemin dependency not installed: ${error.message}. Please install imagemin and required plugins with: npm install imagemin imagemin-pngquant imagemin-jpegtran imagemin-webp imagemin-gifsicle`)
      }

      if (error.message.includes('plugin not available') || error.message.includes('Failed to load Imagemin plugin')) {
        throw new Error(`${error.message}. This is likely due to missing optional dependencies`)
      }

      // 通用错误处理
      throw new Error(`Imagemin compression failed: ${error.message}`)
    }
    else {
      throw new TypeError(`Imagemin compression failed with unknown error: ${String(error)}`)
    }
  }
}

// 检测图片类型
function getImageType(buffer: Buffer): string {
  // PNG signature
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return 'image/png'
  }

  // JPEG signature
  if (buffer.slice(0, 2).equals(Buffer.from([0xFF, 0xD8]))) {
    return 'image/jpeg'
  }

  // WebP signature
  if (buffer.slice(0, 4).equals(Buffer.from('RIFF', 'ascii'))
    && buffer.slice(8, 12).equals(Buffer.from('WEBP', 'ascii'))) {
    return 'image/webp'
  }

  // GIF signature
  if (buffer.slice(0, 6).equals(Buffer.from('GIF87a', 'ascii'))
    || buffer.slice(0, 6).equals(Buffer.from('GIF89a', 'ascii'))) {
    return 'image/gif'
  }

  // 默认JPEG
  return 'image/jpeg'
}

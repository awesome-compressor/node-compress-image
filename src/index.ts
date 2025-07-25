import type {
  BlobInterface,
  CompressionAttempt,
  CompressionStats,
  CompressOptions,
  CompressorTool,
  CompressResult,
  CompressResultItem,
  CompressResultType,
  FileInterface,
  MultipleCompressResults,
  ToolConfig,
} from './types'
import process from 'node:process'

import { convertBufferToType, getBufferFromFile } from './utils'

// 开发环境日志工具
const devLog = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args)
    }
  },
  warn: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(...args)
    }
  },
  table: (data: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.table(data)
    }
  },
}

// 动态导入压缩工具（可选依赖）
async function tryImportTool(toolName: string) {
  try {
    switch (toolName) {
      case 'sharp':
        return (await import('./tools/sharp')).compressWithSharp
      case 'imagemin':
        return (await import('./tools/imagemin')).compressWithImagemin
      case 'jimp':
        return (await import('./tools/jimp')).compressWithJimp
      case 'tinify':
        return (await import('./tools/tinify')).compressWithTinify
      default:
        return null
    }
  }
  catch (error) {
    devLog.warn(`Tool ${toolName} not available:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

// 支持 EXIF 保留的工具（这些工具需要额外配置才能保留EXIF）
const EXIF_SUPPORTED_TOOLS: CompressorTool[] = [
  'sharp',
  'jimp',
  'imagemin',
]

// 不同图片类型推荐的工具组合
const toolsCollections: Record<string, CompressorTool[]> = {
  png: ['sharp', 'imagemin', 'tinify'],
  gif: ['imagemin'],
  webp: ['sharp', 'imagemin', 'tinify'],
  jpeg: ['sharp', 'imagemin', 'jimp', 'tinify'],
  others: ['sharp', 'imagemin', 'jimp', 'tinify'],
}

// 重载：支持新的选项对象参数 - 返回多结果
export async function compress<T extends CompressResultType = 'buffer'>(
  file: FileInterface | BlobInterface | Buffer,
  options: CompressOptions & { type?: T, returnAllResults: true },
): Promise<MultipleCompressResults<T>>

// 重载：支持新的选项对象参数 - 返回单结果
export async function compress<T extends CompressResultType = 'buffer'>(
  file: FileInterface | BlobInterface | Buffer,
  options: CompressOptions & { type?: T, returnAllResults?: false },
): Promise<CompressResult<T>>

// 重载：支持旧的参数格式(向后兼容)
export async function compress<T extends CompressResultType = 'buffer'>(
  file: FileInterface | BlobInterface | Buffer,
  quality?: number,
  type?: T,
): Promise<CompressResult<T>>

// 实现
export async function compress<T extends CompressResultType = 'buffer'>(
  file: FileInterface | BlobInterface | Buffer,
  qualityOrOptions?: number | (CompressOptions & { type?: T }),
  type?: T,
): Promise<CompressResult<T> | MultipleCompressResults<T>> {
  // 解析参数
  let options: CompressOptions & { type?: T }

  if (typeof qualityOrOptions === 'object') {
    // 新的选项对象格式
    options = qualityOrOptions
  }
  else {
    // 旧的参数格式(向后兼容)
    options = {
      quality: qualityOrOptions || 0.6,
      mode: 'keepSize',
      type: type || ('buffer' as T),
    }
  }

  // 设置默认值
  const {
    quality = 0.6,
    mode = 'keepSize',
    targetWidth,
    targetHeight,
    maxWidth,
    maxHeight,
    preserveExif = false,
    returnAllResults = false,
    type: resultType = 'buffer' as T,
  } = options

  // 获取输入的Buffer
  let inputBuffer: Buffer
  let fileName: string | undefined

  if (Buffer.isBuffer(file)) {
    inputBuffer = file
  }
  else {
    inputBuffer = await getBufferFromFile(file)
    if ('name' in file) {
      fileName = file.name
    }
  }

  // 使用多工具压缩比对策略
  const compressionOptions = {
    quality,
    mode,
    targetWidth,
    targetHeight,
    maxWidth,
    maxHeight,
    preserveExif,
  }

  // 根据文件类型选择合适的压缩工具组合
  const imageType = getImageType(inputBuffer)
  const tools = imageType.includes('png')
    ? toolsCollections.png
    : imageType.includes('gif')
      ? toolsCollections.gif
      : imageType.includes('webp')
        ? toolsCollections.webp
        : imageType.includes('jpeg') || imageType.includes('jpg')
          ? toolsCollections.jpeg
          : toolsCollections.others

  // 如果需要返回所有结果
  if (returnAllResults) {
    return await compressWithMultipleToolsAndReturnAll(
      inputBuffer,
      compressionOptions,
      tools,
      resultType,
      fileName,
    )
  }

  // 否则返回最佳结果
  const bestResult: Buffer = await compressWithMultipleTools(
    inputBuffer,
    compressionOptions,
    tools,
  )

  return convertBufferToType(bestResult, resultType, fileName)
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

// 多工具压缩比对核心函数
async function compressWithMultipleTools(
  buffer: Buffer,
  options: CompressOptions,
  tools: CompressorTool[],
): Promise<Buffer> {
  const totalStartTime = performance.now()

  // 当需要保留 EXIF 时，过滤掉不支持的工具
  if (options.preserveExif) {
    tools = tools.filter(tool => EXIF_SUPPORTED_TOOLS.includes(tool))
    if (tools.length === 0) {
      throw new Error(
        'No EXIF-supporting tools available for this file type. Please disable preserveExif or use a different file format.',
      )
    }
    devLog.log('preserveExif=true, filtered tools:', tools)
  }

  const attempts: CompressionAttempt[] = []
  // 并行运行所有可用的压缩工具
  const promises = tools.map(async (tool) => {
    const startTime = performance.now()

    try {
      const compressTool = await tryImportTool(tool)
      if (!compressTool) {
        throw new Error(`Tool ${tool} not available`)
      }

      const compressedBuffer = await compressTool(buffer, options)

      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)

      return {
        tool,
        buffer: compressedBuffer,
        size: compressedBuffer.length,
        success: true,
        duration,
      } as CompressionAttempt
    }
    catch (error) {
      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)

      return {
        tool,
        buffer, // 失败时使用原buffer
        size: buffer.length,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      } as CompressionAttempt
    }
  })

  // 等待所有压缩尝试完成（使用 allSettled 确保即使某些工具失败也能获得其他结果）
  const results = await Promise.allSettled(promises)

  // 处理结果，包括成功和失败的情况
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      attempts.push(result.value)
    }
    else {
      devLog.warn('Compression tool failed:', result.reason)
    }
  })

  // 过滤成功的结果
  const successfulAttempts = attempts.filter(attempt => attempt.success)

  if (successfulAttempts.length === 0) {
    devLog.warn('All compression attempts failed, returning original buffer')
    return buffer
  }

  // 选择文件大小最小的结果
  const bestAttempt = successfulAttempts.reduce((best, current) =>
    current.size < best.size ? current : best,
  )

  // 如果最佳压缩结果仍然比原文件大，且质量设置较高，返回原buffer
  if (bestAttempt.size >= buffer.length * 0.98 && (options.quality || 0.6) > 0.85) {
    const totalEndTime = performance.now()
    const totalDuration = Math.round(totalEndTime - totalStartTime)

    devLog.log(
      `Best compression (${bestAttempt.tool}) size: ${bestAttempt.size}, original: ${buffer.length}, using original (total: ${totalDuration}ms)`,
    )
    return buffer
  }

  const totalEndTime = performance.now()
  const totalDuration = Math.round(totalEndTime - totalStartTime)

  devLog.log(
    `Best compression result: ${bestAttempt.tool} (${bestAttempt.size} bytes, ${(((buffer.length - bestAttempt.size) / buffer.length) * 100).toFixed(1)}% reduction, ${bestAttempt.duration}ms) - Total time: ${totalDuration}ms`,
  )

  // 输出所有工具的性能比较
  if (successfulAttempts.length > 1) {
    devLog.table(
      successfulAttempts.map(attempt => ({
        'Tool': attempt.tool,
        'Size (bytes)': attempt.size,
        'Reduction (%)': `${(((buffer.length - attempt.size) / buffer.length) * 100).toFixed(1)}%`,
        'Duration (ms)': attempt.duration,
        'Speed (MB/s)': `${(buffer.length / 1024 / 1024 / (attempt.duration / 1000)).toFixed(2)}`,
      })),
    )
  }

  return bestAttempt.buffer
}

// 多工具压缩并返回所有结果的函数
async function compressWithMultipleToolsAndReturnAll<
  T extends CompressResultType,
>(
  buffer: Buffer,
  options: CompressOptions,
  tools: CompressorTool[],
  resultType: T,
  fileName?: string,
): Promise<MultipleCompressResults<T>> {
  const totalStartTime = performance.now()

  // 当需要保留 EXIF 时，过滤掉不支持的工具
  if (options.preserveExif) {
    tools = tools.filter(tool => EXIF_SUPPORTED_TOOLS.includes(tool))
    if (tools.length === 0) {
      throw new Error(
        'No EXIF-supporting tools available for this file type. Please disable preserveExif or use a different file format.',
      )
    }
    devLog.log('preserveExif=true, filtered tools:', tools)
  }

  const attempts: CompressionAttempt[] = []

  // 并行运行所有压缩工具
  const promises = tools.map(async (tool) => {
    const startTime = performance.now()

    try {
      const compressTool = await tryImportTool(tool)
      if (!compressTool) {
        throw new Error(`Tool ${tool} not available`)
      }

      const compressedBuffer = await compressTool(buffer, options)

      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)

      return {
        tool,
        buffer: compressedBuffer,
        size: compressedBuffer.length,
        success: true,
        duration,
      } as CompressionAttempt
    }
    catch (error) {
      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)

      return {
        tool,
        buffer, // 失败时使用原buffer
        size: buffer.length,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      } as CompressionAttempt
    }
  })

  // 等待所有压缩尝试完成
  const results = await Promise.allSettled(promises)

  // 处理结果
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      attempts.push(result.value)
    }
    else {
      devLog.warn('Compression tool failed:', result.reason)
    }
  })

  if (attempts.length === 0) {
    throw new Error('All compression attempts failed')
  }

  const totalEndTime = performance.now()
  const totalDuration = Math.round(totalEndTime - totalStartTime)

  // 转换所有结果为指定类型
  const allResults: CompressResultItem<T>[] = await Promise.all(
    attempts.map(async (attempt) => {
      const convertedResult = await convertBufferToType(
        attempt.buffer,
        resultType,
        fileName,
      )
      return {
        tool: attempt.tool,
        result: convertedResult,
        originalSize: buffer.length,
        compressedSize: attempt.size,
        compressionRatio: ((buffer.length - attempt.size) / buffer.length) * 100,
        duration: attempt.duration,
        success: attempt.success,
        error: attempt.error,
      }
    }),
  )

  // 找到最佳结果（成功的结果中文件大小最小的）
  const successfulAttempts = attempts.filter(attempt => attempt.success)
  let bestAttempt: CompressionAttempt

  if (successfulAttempts.length > 0) {
    bestAttempt = successfulAttempts.reduce((best, current) =>
      current.size < best.size ? current : best,
    )

    // 如果最佳压缩结果仍然比原文件大，且质量设置较高，使用原文件
    if (bestAttempt.size >= buffer.length * 0.98 && (options.quality || 0.6) > 0.85) {
      bestAttempt = {
        tool: 'original',
        buffer,
        size: buffer.length,
        success: true,
        duration: 0,
      }
    }
  }
  else {
    // 如果所有工具都失败，使用原文件
    bestAttempt = {
      tool: 'original',
      buffer,
      size: buffer.length,
      success: true,
      duration: 0,
    }
  }

  const bestResult = await convertBufferToType(
    bestAttempt.buffer,
    resultType,
    fileName,
  )

  devLog.log(
    `Best compression result: ${bestAttempt.tool} (${bestAttempt.size} bytes, ${(((buffer.length - bestAttempt.size) / buffer.length) * 100).toFixed(1)}% reduction) - Total time: ${totalDuration}ms`,
  )

  // 输出所有工具的性能比较
  if (successfulAttempts.length > 1) {
    devLog.table(
      successfulAttempts.map(attempt => ({
        'Tool': attempt.tool,
        'Size (bytes)': attempt.size,
        'Reduction (%)': `${(((buffer.length - attempt.size) / buffer.length) * 100).toFixed(1)}%`,
        'Duration (ms)': attempt.duration,
        'Speed (MB/s)': `${(buffer.length / 1024 / 1024 / (attempt.duration / 1000)).toFixed(2)}`,
      })),
    )
  }

  return {
    bestResult,
    bestTool: bestAttempt.tool,
    allResults,
    totalDuration,
  }
}

// 带详细统计信息的压缩函数
export async function compressWithStats(
  file: FileInterface | BlobInterface | Buffer,
  qualityOrOptions?: number | CompressOptions,
): Promise<CompressionStats> {
  // 获取输入的Buffer
  let inputBuffer: Buffer

  if (Buffer.isBuffer(file)) {
    inputBuffer = file
  }
  else {
    inputBuffer = await getBufferFromFile(file)
  }

  // 解析选项
  const options: CompressOptions = typeof qualityOrOptions === 'object'
    ? qualityOrOptions
    : {
        quality: qualityOrOptions || 0.6,
        mode: 'keepSize',
      }

  // 根据文件类型选择工具
  const imageType = getImageType(inputBuffer)
  const tools = imageType.includes('png')
    ? toolsCollections.png
    : imageType.includes('gif')
      ? toolsCollections.gif
      : imageType.includes('webp')
        ? toolsCollections.webp
        : imageType.includes('jpeg') || imageType.includes('jpg')
          ? toolsCollections.jpeg
          : toolsCollections.others

  return await compressWithMultipleToolsWithStats(inputBuffer, options, tools)
}

// 带统计信息的多工具压缩函数
async function compressWithMultipleToolsWithStats(
  buffer: Buffer,
  options: CompressOptions,
  tools: CompressorTool[],
): Promise<CompressionStats> {
  const totalStartTime = performance.now()

  // 当需要保留 EXIF 时，过滤掉不支持的工具
  if (options.preserveExif) {
    tools = tools.filter(tool => EXIF_SUPPORTED_TOOLS.includes(tool))
    if (tools.length === 0) {
      throw new Error(
        'No EXIF-supporting tools available for this file type. Please disable preserveExif or use a different file format.',
      )
    }
    devLog.log('preserveExif=true, filtered tools:', tools)
  }

  const attempts: CompressionAttempt[] = []

  // 并行运行所有压缩工具（复用现有逻辑）
  const promises = tools.map(async (tool) => {
    const startTime = performance.now()

    try {
      const compressTool = await tryImportTool(tool)
      if (!compressTool) {
        throw new Error(`Tool ${tool} not available`)
      }

      const compressedBuffer = await compressTool(buffer, options)

      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)

      return {
        tool,
        buffer: compressedBuffer,
        size: compressedBuffer.length,
        success: true,
        duration,
      } as CompressionAttempt
    }
    catch (error) {
      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)

      return {
        tool,
        buffer,
        size: buffer.length,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
      } as CompressionAttempt
    }
  })

  const results = await Promise.allSettled(promises)

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      attempts.push(result.value)
    }
  })

  const successfulAttempts = attempts.filter(attempt => attempt.success)
  const bestAttempt
    = successfulAttempts.length > 0
      ? successfulAttempts.reduce((best, current) =>
          current.size < best.size ? current : best,
        )
      : {
          tool: 'none' as CompressorTool,
          buffer,
          size: buffer.length,
          success: false,
          duration: 0,
        }

  const totalEndTime = performance.now()
  const totalDuration = Math.round(totalEndTime - totalStartTime)

  // 创建Blob用于统计信息
  const compressedBlob = {
    size: bestAttempt.buffer.length,
    type: getImageType(bestAttempt.buffer),
    async arrayBuffer() {
      return new ArrayBuffer(bestAttempt.buffer.byteLength)
    },
  }

  return {
    bestTool: bestAttempt.tool,
    compressedFile: compressedBlob,
    originalSize: buffer.length,
    compressedSize: bestAttempt.size,
    compressionRatio: ((buffer.length - bestAttempt.size) / buffer.length) * 100,
    totalDuration,
    toolsUsed: attempts.map(attempt => ({
      tool: attempt.tool,
      size: attempt.size,
      duration: attempt.duration,
      compressionRatio: ((buffer.length - attempt.size) / buffer.length) * 100,
      success: attempt.success,
      error: attempt.error,
    })),
  }
}

// 导出类型和主要函数
export type {
  BlobInterface,
  CompressionStats,
  CompressOptions,
  CompressorTool,
  CompressResult,
  CompressResultItem,
  CompressResultType,
  FileInterface,
  MultipleCompressResults,
  ToolConfig,
}

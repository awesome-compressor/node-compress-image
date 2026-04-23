/// <reference types="node" />

// 压缩结果类型
export type CompressResultType = 'blob' | 'buffer' | 'base64' | 'file'
export type ImageFormat = 'avif' | 'gif' | 'jpeg' | 'png' | 'webp'
export type OutputImageFormat = 'auto' | 'same' | ImageFormat
export type CompressStrategy = 'balanced' | 'preserveFormat' | 'smallest' | 'targetSize'
export type MetadataMode = 'all' | 'exif' | 'strip'

// 压缩工具类型
export type CompressorTool
  = | 'sharp'
    | 'jimp'
    | 'imagemin'
    | 'tinify'
    | 'original'

// File接口定义（Node.js环境）
export interface FileInterface {
  name: string
  size: number
  type: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

// Blob接口定义（Node.js环境）
export interface BlobInterface {
  size: number
  type: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

/**
 * 工具配置接口
 */
export interface ToolConfig {
  /**
   * 工具名称
   */
  name: string
  /**
   * API 密钥或其他配置参数
   */
  key?: string
  /**
   * 其他自定义配置参数
   */
  [key: string]: any
}

interface CompressOptionsBase {
  quality?: number // 压缩质量 0-1
  targetWidth?: number // 目标宽度
  targetHeight?: number // 目标高度
  maxWidth?: number // 最大宽度
  maxHeight?: number // 最大高度
  preserveExif?: boolean // 尝试保留EXIF信息，目前仅 Sharp 生效
  metadata?: MetadataMode // 元数据策略，默认 strip
  format?: OutputImageFormat // 输出格式，默认 same
  targetBytes?: number // 目标输出体积，单位 bytes
  strategy?: CompressStrategy // 最优结果选择策略，默认 smallest
  /**
   * 工具特定的配置参数
   */
  toolConfigs?: ToolConfig[]
}

// 压缩选项
export type CompressOptions<T extends CompressResultType = CompressResultType>
  = CompressOptionsBase & (
    | { returnAllResults?: false, type?: undefined }
    | { returnAllResults: true, type?: undefined }
    | (T extends CompressResultType
      ? | { returnAllResults?: false, type: T }
      | { returnAllResults: true, type: T }
      : never)
  )

export type CompressionStatsOptions = CompressOptionsBase

// 压缩结果
export type CompressResult<T extends CompressResultType> = T extends 'blob'
  ? BlobInterface
  : T extends 'buffer'
    ? Buffer
    : T extends 'base64'
      ? string
      : T extends 'file'
        ? FileInterface
        : BlobInterface

// 单个工具的压缩结果项
export interface CompressResultItem<T extends CompressResultType> {
  tool: string
  result: CompressResult<T>
  originalSize: number
  compressedSize: number
  compressionRatio: number
  duration: number
  success: boolean
  error?: string
}

// 多个工具的压缩结果
export interface MultipleCompressResults<T extends CompressResultType> {
  bestResult: CompressResult<T>
  bestTool: string
  format?: ImageFormat
  selectedReason?: string
  allResults: CompressResultItem<T>[]
  totalDuration: number
  warnings?: string[]
}

// 压缩统计信息
export interface CompressionStats {
  bestTool: string
  compressedFile: BlobInterface
  format?: ImageFormat
  originalSize: number
  compressedSize: number
  compressionRatio: number
  selectedReason?: string
  totalDuration: number
  warnings?: string[]
  toolsUsed: {
    tool: string
    size: number
    duration: number
    compressionRatio: number
    success: boolean
    error?: string
  }[]
}

export interface ImageMetadata {
  format?: ImageFormat
  width?: number
  height?: number
  hasExif: boolean
  hasIcc: boolean
  hasXmp: boolean
}

export interface DetailedCompressionResult<T extends CompressResultType = 'buffer'> {
  output: CompressResult<T>
  bestTool: string
  format: ImageFormat
  originalSize: number
  compressedSize: number
  compressionRatio: number
  selectedReason: string
  totalDuration: number
  warnings: string[]
  metadata: {
    input: ImageMetadata
    output: ImageMetadata
    preserved: MetadataMode
  }
  toolsUsed: {
    tool: string
    size: number
    duration: number
    compressionRatio: number
    success: boolean
    format?: ImageFormat
    quality?: number
    error?: string
  }[]
}

export interface CompressVariantsOptions<T extends CompressResultType = 'buffer'> extends CompressionStatsOptions {
  formats: OutputImageFormat[]
  type?: T
}

export interface CompressVariantResult<T extends CompressResultType = 'buffer'> {
  format: ImageFormat
  result: DetailedCompressionResult<T>
}

export interface ToolAvailability {
  tool: Exclude<CompressorTool, 'original'>
  installed: boolean
  configured: boolean
  optional: boolean
  inputFormats: ImageFormat[]
  outputFormats: OutputImageFormat[]
  supportsQuality: boolean
  supportsResize: boolean
  supportsMetadata: MetadataMode[]
  error?: string
}

export interface CompressorCapabilities {
  inputFormats: ImageFormat[]
  outputFormats: OutputImageFormat[]
  strategies: CompressStrategy[]
  metadata: MetadataMode[]
  tools: ToolAvailability[]
}

export interface CompressFilesOptions extends CompressionStatsOptions {
  outputDir: string
  cacheFile?: string
  concurrency?: number
}

export interface CompressFileResult {
  inputPath: string
  outputPath: string
  skipped: boolean
  bestTool: string
  format: ImageFormat
  originalSize: number
  compressedSize: number
  compressionRatio: number
  selectedReason: string
  warnings: string[]
}

// 压缩尝试结果
export interface CompressionAttempt {
  tool: CompressorTool
  buffer: Buffer
  size: number
  success: boolean
  format?: ImageFormat
  quality?: number
  error?: string
  duration: number
}

// 压缩结果类型
export type CompressResultType = 'blob' | 'buffer' | 'base64' | 'file'

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

// 压缩模式
export type CompressMode = 'keepSize' | 'keepQuality'

// 压缩选项
export interface CompressOptions {
  quality?: number // 压缩质量 0-1
  mode?: CompressMode // 压缩模式
  targetWidth?: number // 目标宽度
  targetHeight?: number // 目标高度
  maxWidth?: number // 最大宽度
  maxHeight?: number // 最大高度
  preserveExif?: boolean // 是否保留EXIF信息
  returnAllResults?: boolean // 是否返回所有工具的结果
}

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
  allResults: CompressResultItem<T>[]
  totalDuration: number
}

// 压缩统计信息
export interface CompressionStats {
  bestTool: string
  compressedFile: BlobInterface
  originalSize: number
  compressedSize: number
  compressionRatio: number
  totalDuration: number
  toolsUsed: {
    tool: string
    size: number
    duration: number
    compressionRatio: number
    success: boolean
    error?: string
  }[]
}

// 压缩工具类型
export type CompressorTool
  = | 'sharp'
    | 'jimp'
    | 'imagemin'
    | 'original'

// 压缩尝试结果
export interface CompressionAttempt {
  tool: CompressorTool
  buffer: Buffer
  size: number
  success: boolean
  error?: string
  duration: number
}

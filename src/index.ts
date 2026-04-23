import type { Sharp } from 'sharp'
import type {
  BlobInterface,
  CompressFileResult,
  CompressFilesOptions,
  CompressionAttempt,
  CompressionStats,
  CompressionStatsOptions,
  CompressOptions,
  CompressorCapabilities,
  CompressorTool,
  CompressResult,
  CompressResultItem,
  CompressResultType,
  CompressStrategy,
  CompressVariantResult,
  CompressVariantsOptions,
  DetailedCompressionResult,
  FileInterface,
  ImageFormat,
  ImageMetadata,
  MetadataMode,
  MultipleCompressResults,
  OutputImageFormat,
  ToolAvailability,
  ToolConfig,
} from './types'
import { Buffer as NodeBuffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

import { bufferToBlob, convertBufferToType, getBufferFromFile } from './utils'

type RealCompressorTool = Exclude<CompressorTool, 'original'>
type ImageType = 'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp'
type ToolCollectionKey = 'gif' | 'jpeg' | 'png' | 'webp'

interface NormalizedCompressOptions {
  quality: number
  targetWidth?: number
  targetHeight?: number
  maxWidth?: number
  maxHeight?: number
  preserveExif: boolean
  metadata: MetadataMode
  format: OutputImageFormat
  targetBytes?: number
  strategy: CompressStrategy
  returnAllResults: boolean
  toolConfigs?: ToolConfig[]
  type: CompressResultType
}

interface InputFile {
  buffer: Buffer
  fileName?: string
}

interface CoreCompressionResult {
  bestAttempt: CompressionAttempt
  attempts: CompressionAttempt[]
  selectedReason: string
  totalDuration: number
  warnings: string[]
  inputMetadata: ImageMetadata
  outputMetadata: ImageMetadata
}

interface StoredBatchManifest {
  version: 1
  entries: Record<string, {
    compressedSize: number
    inputHash: string
    optionsHash: string
    outputPath: string
  }>
}

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

const realTools: RealCompressorTool[] = ['sharp', 'imagemin', 'jimp', 'tinify']
const supportedInputFormats: ImageFormat[] = ['jpeg', 'png', 'webp', 'gif']
const supportedOutputFormats: OutputImageFormat[] = ['same', 'auto', 'jpeg', 'png', 'webp', 'avif']
const supportedStrategies: CompressStrategy[] = ['smallest', 'balanced', 'preserveFormat', 'targetSize']
const supportedMetadataModes: MetadataMode[] = ['strip', 'exif', 'all']

const toolsCollections: Record<ToolCollectionKey, RealCompressorTool[]> = {
  png: ['sharp', 'imagemin', 'tinify'],
  gif: ['imagemin'],
  webp: ['sharp', 'imagemin', 'tinify'],
  jpeg: ['sharp', 'imagemin', 'jimp', 'tinify'],
}

const toolCapabilities: Record<RealCompressorTool, Omit<ToolAvailability, 'configured' | 'error' | 'installed' | 'tool'>> = {
  sharp: {
    optional: false,
    inputFormats: ['jpeg', 'png', 'webp', 'gif'],
    outputFormats: ['same', 'auto', 'jpeg', 'png', 'webp', 'avif'],
    supportsQuality: true,
    supportsResize: true,
    supportsMetadata: ['strip', 'exif', 'all'],
  },
  imagemin: {
    optional: false,
    inputFormats: ['jpeg', 'png', 'webp', 'gif'],
    outputFormats: ['same'],
    supportsQuality: true,
    supportsResize: false,
    supportsMetadata: ['strip'],
  },
  jimp: {
    optional: true,
    inputFormats: ['jpeg'],
    outputFormats: ['same'],
    supportsQuality: true,
    supportsResize: true,
    supportsMetadata: ['strip'],
  },
  tinify: {
    optional: true,
    inputFormats: ['jpeg', 'png', 'webp'],
    outputFormats: ['same', 'jpeg', 'png', 'webp', 'avif'],
    supportsQuality: false,
    supportsResize: true,
    supportsMetadata: ['strip', 'exif'],
  },
}

// 重载：支持新的选项对象参数 - 默认 Buffer 多结果
export async function compress(
  file: FileInterface | BlobInterface | Buffer,
  options: CompressOptions & { type?: undefined, returnAllResults: true },
): Promise<MultipleCompressResults<'buffer'>>

// 重载：支持新的选项对象参数 - 默认 Buffer 单结果
export async function compress(
  file: FileInterface | BlobInterface | Buffer,
  options: CompressOptions & { type?: undefined, returnAllResults?: false },
): Promise<Buffer>

// 重载：支持新的选项对象参数 - 返回多结果
export async function compress<T extends CompressResultType>(
  file: FileInterface | BlobInterface | Buffer,
  options: CompressOptions<T> & { type: T, returnAllResults: true },
): Promise<MultipleCompressResults<T>>

// 重载：支持新的选项对象参数 - 返回单结果
export async function compress<T extends CompressResultType>(
  file: FileInterface | BlobInterface | Buffer,
  options: CompressOptions<T> & { type: T, returnAllResults?: false },
): Promise<CompressResult<T>>

// 重载：支持提前声明的 CompressOptions 变量
export async function compress<T extends CompressResultType = 'buffer'>(
  file: FileInterface | BlobInterface | Buffer,
  options: CompressOptions<T>,
): Promise<CompressResult<T> | MultipleCompressResults<T>>

// 重载：支持旧的参数格式(向后兼容)
export async function compress<T extends CompressResultType = 'buffer'>(
  file: FileInterface | BlobInterface | Buffer,
  quality?: number,
  type?: T,
): Promise<CompressResult<T>>

export async function compress<T extends CompressResultType = 'buffer'>(
  file: FileInterface | BlobInterface | Buffer,
  qualityOrOptions?: number | CompressOptions<T>,
  type?: T,
): Promise<CompressResult<T> | MultipleCompressResults<T>> {
  const options = normalizeOptions(qualityOrOptions, type)
  const input = await readInputFile(file)
  const tools = getPreparedTools(input.buffer, options)
  const coreResult = await runCompressionCore(input.buffer, options, tools)

  if (options.returnAllResults) {
    const allResults = await Promise.all(
      coreResult.attempts.map(async attempt => createResultItem<T>(attempt, input.buffer.length, options.type as T, input.fileName)),
    )

    return {
      bestResult: await convertBufferToType(coreResult.bestAttempt.buffer, options.type as T, input.fileName),
      bestTool: coreResult.bestAttempt.tool,
      format: coreResult.bestAttempt.format,
      selectedReason: coreResult.selectedReason,
      allResults,
      totalDuration: coreResult.totalDuration,
      warnings: coreResult.warnings,
    }
  }

  return await convertBufferToType(coreResult.bestAttempt.buffer, options.type as T, input.fileName)
}

export async function compressWithStats(
  file: FileInterface | BlobInterface | Buffer,
  qualityOrOptions?: number | CompressionStatsOptions,
): Promise<CompressionStats> {
  if (qualityOrOptions !== undefined && typeof qualityOrOptions === 'object') {
    if ((qualityOrOptions as CompressOptions).type !== undefined) {
      throw new RangeError('compressWithStats does not support type; compressedFile is always a BlobInterface')
    }
    if ((qualityOrOptions as CompressOptions).returnAllResults !== undefined) {
      throw new RangeError('compressWithStats does not support returnAllResults')
    }
  }

  const options = normalizeOptions(qualityOrOptions, 'buffer')
  const input = await readInputFile(file)
  const tools = getPreparedTools(input.buffer, options)
  const coreResult = await runCompressionCore(input.buffer, options, tools)

  return {
    bestTool: coreResult.bestAttempt.tool,
    compressedFile: bufferToBlob(coreResult.bestAttempt.buffer, mimeTypeForFormat(coreResult.bestAttempt.format ?? 'png')),
    format: coreResult.bestAttempt.format,
    originalSize: input.buffer.length,
    compressedSize: coreResult.bestAttempt.size,
    compressionRatio: compressionRatio(input.buffer.length, coreResult.bestAttempt.size),
    selectedReason: coreResult.selectedReason,
    totalDuration: coreResult.totalDuration,
    warnings: coreResult.warnings,
    toolsUsed: coreResult.attempts.map(attempt => ({
      tool: attempt.tool,
      size: attempt.size,
      duration: attempt.duration,
      compressionRatio: compressionRatio(input.buffer.length, attempt.size),
      success: attempt.success,
      error: attempt.error,
    })),
  }
}

export async function compressDetailed<T extends CompressResultType = 'buffer'>(
  file: FileInterface | BlobInterface | Buffer,
  optionsInput?: CompressOptions<T>,
): Promise<DetailedCompressionResult<T>> {
  const options = normalizeOptions(optionsInput, undefined)
  const input = await readInputFile(file)
  const tools = getPreparedTools(input.buffer, options)
  const coreResult = await runCompressionCore(input.buffer, options, tools)

  return createDetailedResult<T>(coreResult, input.buffer.length, options, input.fileName)
}

export async function compressVariants<T extends CompressResultType = 'buffer'>(
  file: FileInterface | BlobInterface | Buffer,
  optionsInput: CompressVariantsOptions<T>,
): Promise<CompressVariantResult<T>[]> {
  validateVariantFormats(optionsInput.formats)

  const input = await readInputFile(file)
  const results: CompressVariantResult<T>[] = []

  for (const format of optionsInput.formats) {
    const options = normalizeOptions({ ...optionsInput, format }, optionsInput.type)
    const tools = getPreparedTools(input.buffer, options)
    const coreResult = await runCompressionCore(input.buffer, options, tools)
    const detailed = await createDetailedResult<T>(coreResult, input.buffer.length, options, input.fileName)

    results.push({
      format: detailed.format,
      result: detailed,
    })
  }

  return results
}

export async function getAvailableTools(toolConfigs?: ToolConfig[]): Promise<ToolAvailability[]> {
  return await Promise.all(realTools.map(tool => detectToolAvailability(tool, toolConfigs)))
}

export function getSupportedFormats(): ImageFormat[] {
  return [...supportedInputFormats]
}

export async function getCapabilities(toolConfigs?: ToolConfig[]): Promise<CompressorCapabilities> {
  return {
    inputFormats: [...supportedInputFormats],
    outputFormats: [...supportedOutputFormats],
    strategies: [...supportedStrategies],
    metadata: [...supportedMetadataModes],
    tools: await getAvailableTools(toolConfigs),
  }
}

export async function compressFiles(
  inputPaths: string[],
  options: CompressFilesOptions,
): Promise<CompressFileResult[]> {
  validateCompressFilesOptions(inputPaths, options)

  await fs.mkdir(options.outputDir, { recursive: true })

  const cacheFile = options.cacheFile
  const manifest = cacheFile ? await readBatchManifest(cacheFile) : undefined
  const optionsHash = hashString(JSON.stringify({
    format: options.format ?? 'same',
    maxHeight: options.maxHeight,
    maxWidth: options.maxWidth,
    metadata: options.metadata ?? (options.preserveExif ? 'exif' : 'strip'),
    preserveExif: options.preserveExif,
    quality: options.quality ?? 0.6,
    strategy: options.strategy ?? 'smallest',
    targetBytes: options.targetBytes,
    targetHeight: options.targetHeight,
    targetWidth: options.targetWidth,
    toolConfigs: options.toolConfigs?.map(config => ({ name: config.name })),
  }))

  const results: CompressFileResult[] = []
  let nextIndex = 0
  const concurrency = options.concurrency ?? 4

  async function worker() {
    while (nextIndex < inputPaths.length) {
      const currentIndex = nextIndex++
      results[currentIndex] = await compressOneFile(inputPaths[currentIndex], options, manifest, optionsHash)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, inputPaths.length) }, () => worker()))

  if (cacheFile && manifest) {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true })
    await fs.writeFile(cacheFile, `${JSON.stringify(manifest, null, 2)}\n`)
  }

  return results
}

async function compressOneFile(
  inputPath: string,
  options: CompressFilesOptions,
  manifest: StoredBatchManifest | undefined,
  optionsHash: string,
): Promise<CompressFileResult> {
  const inputBuffer = await fs.readFile(inputPath)
  const inputHash = hashBuffer(inputBuffer)
  const cached = manifest?.entries[inputPath]

  if (cached && cached.inputHash === inputHash && cached.optionsHash === optionsHash && await fileExists(cached.outputPath)) {
    return {
      inputPath,
      outputPath: cached.outputPath,
      skipped: true,
      bestTool: 'cache',
      format: extensionToFormat(path.extname(cached.outputPath)) ?? 'jpeg',
      originalSize: inputBuffer.length,
      compressedSize: cached.compressedSize,
      compressionRatio: compressionRatio(inputBuffer.length, cached.compressedSize),
      selectedReason: 'cache hit',
      warnings: [],
    }
  }

  const detailed = await compressDetailed(inputBuffer, { ...options, type: 'buffer' })
  const outputPath = path.join(
    options.outputDir,
    `${path.basename(inputPath, path.extname(inputPath))}.${extensionForFormat(detailed.format)}`,
  )

  await fs.writeFile(outputPath, detailed.output)

  if (manifest) {
    manifest.entries[inputPath] = {
      inputHash,
      optionsHash,
      outputPath,
      compressedSize: detailed.compressedSize,
    }
  }

  return {
    inputPath,
    outputPath,
    skipped: false,
    bestTool: detailed.bestTool,
    format: detailed.format,
    originalSize: detailed.originalSize,
    compressedSize: detailed.compressedSize,
    compressionRatio: detailed.compressionRatio,
    selectedReason: detailed.selectedReason,
    warnings: detailed.warnings,
  }
}

async function tryImportTool(toolName: RealCompressorTool) {
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
    }
  }
  catch (error) {
    devLog.warn(`Tool ${toolName} not available:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

async function detectToolAvailability(tool: RealCompressorTool, toolConfigs?: ToolConfig[]): Promise<ToolAvailability> {
  const capabilities = toolCapabilities[tool]
  let installed = false
  let error: string | undefined

  try {
    switch (tool) {
      case 'sharp':
        await import('sharp')
        break
      case 'imagemin':
        await import('imagemin')
        break
      case 'jimp':
        await import('jimp')
        break
      case 'tinify':
        await import('tinify')
        break
    }
    installed = true
  }
  catch (importError) {
    error = importError instanceof Error ? importError.message : String(importError)
  }

  const configured = tool === 'tinify'
    ? Boolean(getTinifyApiKey(toolConfigs))
    : installed

  return {
    tool,
    installed,
    configured: installed && configured,
    error,
    ...capabilities,
  }
}

function normalizeOptions<T extends CompressResultType>(
  qualityOrOptions?: number | CompressOptions<T> | CompressionStatsOptions,
  type?: T,
): NormalizedCompressOptions {
  if (qualityOrOptions === null || Array.isArray(qualityOrOptions)) {
    throw new TypeError('Invalid options: options must be an object')
  }

  const options = (typeof qualityOrOptions === 'object'
    ? qualityOrOptions
    : {
        quality: qualityOrOptions ?? 0.6,
        type: type ?? 'buffer',
      }) as Partial<CompressionStatsOptions & CompressOptions<T>>

  validateQuality(options.quality)
  validateDimensions(options)
  validateBooleanOption(options.preserveExif, 'preserveExif')
  validateBooleanOption((options as CompressOptions).returnAllResults, 'returnAllResults')
  validateToolConfigs(options.toolConfigs)
  validateMetadataMode(options.metadata)
  validateOutputFormat(options.format)
  validateTargetBytes(options.targetBytes)
  validateStrategy(options.strategy)

  const resultType = ((options as CompressOptions).type ?? type ?? 'buffer') as CompressResultType
  validateResultType(resultType)

  const metadata = options.metadata ?? (options.preserveExif ? 'exif' : 'strip')

  return {
    quality: options.quality ?? 0.6,
    targetWidth: options.targetWidth,
    targetHeight: options.targetHeight,
    maxWidth: options.maxWidth,
    maxHeight: options.maxHeight,
    preserveExif: options.preserveExif ?? metadata !== 'strip',
    metadata,
    format: options.format ?? 'same',
    targetBytes: options.targetBytes,
    strategy: options.strategy ?? (options.targetBytes ? 'targetSize' : 'smallest'),
    returnAllResults: (options as CompressOptions).returnAllResults ?? false,
    toolConfigs: options.toolConfigs,
    type: resultType,
  }
}

async function readInputFile(file: FileInterface | BlobInterface | Buffer): Promise<InputFile> {
  if (NodeBuffer.isBuffer(file)) {
    return { buffer: file }
  }

  if (file && typeof file === 'object' && typeof file.arrayBuffer === 'function') {
    if ('name' in file && typeof file.name !== 'string') {
      throw new TypeError('Invalid file input: file.name must be a string')
    }

    return {
      buffer: await getBufferFromFile(file),
      fileName: 'name' in file ? file.name : undefined,
    }
  }

  throw new TypeError('Invalid file input: file must be a Buffer, Blob-like object, or File-like object')
}

function getPreparedTools(buffer: Buffer, options: NormalizedCompressOptions): RealCompressorTool[] {
  const imageType = getImageType(buffer)
  let tools = getToolsForImageType(imageType)

  if (options.metadata !== 'strip') {
    tools = tools.filter(tool => toolCapabilities[tool].supportsMetadata.includes(options.metadata))
    if (tools.length === 0) {
      throw new Error(
        `No ${options.metadata} metadata-supporting tools available for this file type. Please use metadata: 'strip' or a different file format.`,
      )
    }
    devLog.log(`metadata=${options.metadata}, filtered tools:`, tools)
  }

  return tools
}

async function runCompressionCore(
  buffer: Buffer,
  options: NormalizedCompressOptions,
  tools: RealCompressorTool[],
): Promise<CoreCompressionResult> {
  const totalStartTime = performance.now()
  const originalFormat = imageTypeToFormat(getImageType(buffer))
  const inputMetadata = await readImageMetadata(buffer)
  const warnings: string[] = []

  const attempts = await Promise.all(tools.map(tool => runToolAttempt(tool, buffer, options, originalFormat)))
  const successfulAttempts = attempts.filter(attempt => attempt.success)
  let { attempt: bestAttempt, reason } = await selectBestAttempt(successfulAttempts, buffer, options, originalFormat)

  if (successfulAttempts.length === 0) {
    warnings.push('All compression attempts failed; returned original input')
  }

  if (bestAttempt.tool === 'original' && successfulAttempts.length > 0) {
    warnings.push(reason)
  }

  for (const attempt of attempts) {
    if (!attempt.success && attempt.error) {
      warnings.push(`${attempt.tool} failed: ${attempt.error}`)
    }
  }

  const totalEndTime = performance.now()
  const outputMetadata = await readImageMetadata(bestAttempt.buffer)

  bestAttempt = {
    ...bestAttempt,
    format: bestAttempt.format ?? outputMetadata.format ?? originalFormat,
  }

  devLog.log(
    `Best compression result: ${bestAttempt.tool} (${bestAttempt.size} bytes, ${compressionRatio(buffer.length, bestAttempt.size).toFixed(1)}% reduction) - Total time: ${Math.round(totalEndTime - totalStartTime)}ms`,
  )

  if (successfulAttempts.length > 1) {
    devLog.table(successfulAttempts.map(attempt => ({
      'Tool': attempt.tool,
      'Format': attempt.format ?? '-',
      'Size (bytes)': attempt.size,
      'Reduction (%)': `${compressionRatio(buffer.length, attempt.size).toFixed(1)}%`,
      'Duration (ms)': attempt.duration,
    })))
  }

  return {
    bestAttempt,
    attempts,
    selectedReason: reason,
    totalDuration: Math.round(totalEndTime - totalStartTime),
    warnings,
    inputMetadata,
    outputMetadata,
  }
}

async function runToolAttempt(
  tool: RealCompressorTool,
  buffer: Buffer,
  options: NormalizedCompressOptions,
  originalFormat: ImageFormat,
): Promise<CompressionAttempt> {
  const startTime = performance.now()

  try {
    const compressTool = await tryImportTool(tool)
    if (!compressTool) {
      throw new Error(`Tool ${tool} not available`)
    }

    const result = options.targetBytes
      ? await runToolToTargetBytes(compressTool, buffer, options, originalFormat)
      : await runToolOnce(compressTool, buffer, options, options.quality, originalFormat)

    return {
      tool,
      buffer: result.buffer,
      size: result.buffer.length,
      success: true,
      duration: Math.round(performance.now() - startTime),
      format: result.format,
      quality: result.quality,
    }
  }
  catch (error) {
    return {
      tool,
      buffer,
      size: buffer.length,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Math.round(performance.now() - startTime),
      format: originalFormat,
    }
  }
}

async function runToolToTargetBytes(
  compressTool: (buffer: Buffer, options: CompressOptions) => Promise<Buffer>,
  buffer: Buffer,
  options: NormalizedCompressOptions,
  originalFormat: ImageFormat,
): Promise<{ buffer: Buffer, format: ImageFormat, quality: number }> {
  const targetBytes = options.targetBytes!
  let low = 0
  let high = options.quality
  let bestUnderTarget: { buffer: Buffer, format: ImageFormat, quality: number } | undefined
  let smallest: { buffer: Buffer, format: ImageFormat, quality: number } | undefined

  for (let index = 0; index < 6; index++) {
    const quality = index === 0 ? high : (low + high) / 2
    const result = await runToolOnce(compressTool, buffer, options, quality, originalFormat)

    if (!smallest || result.buffer.length < smallest.buffer.length) {
      smallest = result
    }

    if (result.buffer.length <= targetBytes) {
      bestUnderTarget = result
      low = quality
    }
    else {
      high = quality
    }
  }

  return bestUnderTarget ?? smallest!
}

async function runToolOnce(
  compressTool: (buffer: Buffer, options: CompressOptions) => Promise<Buffer>,
  buffer: Buffer,
  options: NormalizedCompressOptions,
  quality: number,
  originalFormat: ImageFormat,
): Promise<{ buffer: Buffer, format: ImageFormat, quality: number }> {
  const compressedBuffer = await compressTool(buffer, toToolOptions(options, quality))
  const formatted = await formatBuffer(compressedBuffer, options, originalFormat)
  return {
    buffer: formatted.buffer,
    format: formatted.format,
    quality,
  }
}

async function selectBestAttempt(
  successfulAttempts: CompressionAttempt[],
  originalBuffer: Buffer,
  options: NormalizedCompressOptions,
  originalFormat: ImageFormat,
): Promise<{ attempt: CompressionAttempt, reason: string }> {
  if (successfulAttempts.length === 0) {
    return {
      attempt: await createOriginalAttempt(originalBuffer, options, originalFormat),
      reason: 'all tools failed; returned original input',
    }
  }

  let selected: CompressionAttempt
  let reason: string

  if (options.strategy === 'targetSize' && options.targetBytes !== undefined) {
    const underTarget = successfulAttempts.filter(attempt => attempt.size <= options.targetBytes!)

    if (underTarget.length > 0) {
      selected = underTarget.reduce((best, current) => current.size > best.size ? current : best)
      reason = `selected largest result under targetBytes (${options.targetBytes})`
    }
    else {
      selected = smallestAttempt(successfulAttempts)
      reason = `no result satisfied targetBytes (${options.targetBytes}); selected smallest result`
    }
  }
  else if (options.strategy === 'preserveFormat') {
    const sameFormat = successfulAttempts.filter(attempt => attempt.format === originalFormat)

    if (sameFormat.length > 0) {
      selected = smallestAttempt(sameFormat)
      reason = `selected smallest result preserving ${originalFormat} format`
    }
    else {
      selected = smallestAttempt(successfulAttempts)
      reason = `no ${originalFormat} result available; selected smallest result`
    }
  }
  else if (options.strategy === 'balanced') {
    const smallest = smallestAttempt(successfulAttempts)
    const candidates = successfulAttempts.filter(attempt => attempt.size <= smallest.size * 1.1)
    selected = candidates.reduce((best, current) => current.duration < best.duration ? current : best)
    reason = 'selected fastest result within 10% of smallest size'
  }
  else {
    selected = smallestAttempt(successfulAttempts)
    reason = 'selected smallest successful result'
  }

  if (options.targetBytes === undefined && selected.size >= originalBuffer.length * 0.98 && options.quality > 0.85) {
    return {
      attempt: await createOriginalAttempt(originalBuffer, options, originalFormat),
      reason: 'best result was within 2% of original at high quality; returned original input',
    }
  }

  return { attempt: selected, reason }
}

async function createOriginalAttempt(
  buffer: Buffer,
  options: NormalizedCompressOptions,
  originalFormat: ImageFormat,
): Promise<CompressionAttempt> {
  let formatted: { buffer: Buffer, format: ImageFormat }

  try {
    formatted = await formatBuffer(buffer, options, originalFormat)
  }
  catch {
    formatted = { buffer, format: originalFormat }
  }

  return {
    tool: 'original',
    buffer: formatted.buffer,
    size: formatted.buffer.length,
    success: true,
    duration: 0,
    format: formatted.format,
    quality: options.quality,
  }
}

function smallestAttempt(attempts: CompressionAttempt[]): CompressionAttempt {
  return attempts.reduce((best, current) => current.size < best.size ? current : best)
}

async function formatBuffer(
  buffer: Buffer,
  options: NormalizedCompressOptions,
  originalFormat: ImageFormat,
): Promise<{ buffer: Buffer, format: ImageFormat }> {
  if (options.format === 'same') {
    return { buffer, format: await detectImageFormat(buffer, originalFormat) }
  }

  if (options.format === 'auto') {
    const candidates = await Promise.allSettled([
      Promise.resolve({ buffer, format: await detectImageFormat(buffer, originalFormat) }),
      convertBufferFormat(buffer, 'webp', options),
      convertBufferFormat(buffer, 'avif', options),
    ])

    const successful = candidates
      .filter((candidate): candidate is PromiseFulfilledResult<{ buffer: Buffer, format: ImageFormat }> => candidate.status === 'fulfilled')
      .map(candidate => candidate.value)

    return successful.reduce((best, current) => current.buffer.length < best.buffer.length ? current : best)
  }

  return await convertBufferFormat(buffer, options.format, options)
}

async function convertBufferFormat(
  buffer: Buffer,
  format: ImageFormat,
  options: NormalizedCompressOptions,
): Promise<{ buffer: Buffer, format: ImageFormat }> {
  let processor = sharp(buffer)
  processor = applyOutputMetadata(processor, options.metadata)

  const quality = Math.min(100, Math.max(1, Math.round(options.quality * 100)))

  switch (format) {
    case 'jpeg':
      processor = processor.jpeg({ quality, mozjpeg: true })
      break
    case 'png':
      processor = processor.png({ quality, compressionLevel: 9 })
      break
    case 'webp':
      processor = processor.webp({ quality })
      break
    case 'avif':
      processor = processor.avif({ quality })
      break
    case 'gif':
      processor = processor.gif()
      break
  }

  return {
    buffer: await processor.toBuffer(),
    format,
  }
}

function applyOutputMetadata(processor: Sharp, metadata: MetadataMode): Sharp {
  if (metadata === 'all') {
    return processor.keepMetadata()
  }

  if (metadata === 'exif') {
    return processor.keepExif()
  }

  return processor
}

async function detectImageFormat(buffer: Buffer, fallback: ImageFormat): Promise<ImageFormat> {
  try {
    return imageTypeToFormat(getImageType(buffer))
  }
  catch {
    const metadata = await readImageMetadata(buffer)
    return metadata.format ?? fallback
  }
}

async function readImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  try {
    const metadata = await sharp(buffer).metadata()
    return {
      format: normalizeSharpFormat(metadata.format),
      width: metadata.width,
      height: metadata.height,
      hasExif: Boolean(metadata.exif?.length),
      hasIcc: Boolean(metadata.icc?.length),
      hasXmp: Boolean(metadata.xmp?.length),
    }
  }
  catch {
    return {
      hasExif: false,
      hasIcc: false,
      hasXmp: false,
    }
  }
}

async function createResultItem<T extends CompressResultType>(
  attempt: CompressionAttempt,
  originalSize: number,
  resultType: T,
  fileName?: string,
): Promise<CompressResultItem<T>> {
  return {
    tool: attempt.tool,
    result: await convertBufferToType(attempt.buffer, resultType, fileName),
    originalSize,
    compressedSize: attempt.size,
    compressionRatio: compressionRatio(originalSize, attempt.size),
    duration: attempt.duration,
    success: attempt.success,
    error: attempt.error,
  }
}

async function createDetailedResult<T extends CompressResultType>(
  coreResult: CoreCompressionResult,
  originalSize: number,
  options: NormalizedCompressOptions,
  fileName?: string,
): Promise<DetailedCompressionResult<T>> {
  return {
    output: await convertBufferToType(coreResult.bestAttempt.buffer, options.type as T, fileName),
    bestTool: coreResult.bestAttempt.tool,
    format: coreResult.bestAttempt.format ?? coreResult.outputMetadata.format ?? 'jpeg',
    originalSize,
    compressedSize: coreResult.bestAttempt.size,
    compressionRatio: compressionRatio(originalSize, coreResult.bestAttempt.size),
    selectedReason: coreResult.selectedReason,
    totalDuration: coreResult.totalDuration,
    warnings: coreResult.warnings,
    metadata: {
      input: coreResult.inputMetadata,
      output: coreResult.outputMetadata,
      preserved: options.metadata,
    },
    toolsUsed: coreResult.attempts.map(attempt => ({
      tool: attempt.tool,
      size: attempt.size,
      duration: attempt.duration,
      compressionRatio: compressionRatio(originalSize, attempt.size),
      success: attempt.success,
      format: attempt.format,
      quality: attempt.quality,
      error: attempt.error,
    })),
  }
}

function toToolOptions(options: NormalizedCompressOptions, quality: number): CompressOptions {
  return {
    quality,
    targetWidth: options.targetWidth,
    targetHeight: options.targetHeight,
    maxWidth: options.maxWidth,
    maxHeight: options.maxHeight,
    preserveExif: options.preserveExif,
    metadata: options.metadata,
    format: options.format,
    targetBytes: options.targetBytes,
    strategy: options.strategy,
    toolConfigs: options.toolConfigs,
  } as CompressOptions
}

function getImageType(buffer: Buffer): ImageType {
  if (buffer.slice(0, 8).equals(NodeBuffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return 'image/png'
  }

  if (buffer.slice(0, 2).equals(NodeBuffer.from([0xFF, 0xD8]))) {
    return 'image/jpeg'
  }

  if (buffer.slice(0, 4).equals(NodeBuffer.from('RIFF', 'ascii'))
    && buffer.slice(8, 12).equals(NodeBuffer.from('WEBP', 'ascii'))) {
    return 'image/webp'
  }

  if (buffer.slice(0, 6).equals(NodeBuffer.from('GIF87a', 'ascii'))
    || buffer.slice(0, 6).equals(NodeBuffer.from('GIF89a', 'ascii'))) {
    return 'image/gif'
  }

  throw new Error('Unsupported image format: expected PNG, JPEG, WebP, or GIF input')
}

function getToolsForImageType(imageType: ImageType): RealCompressorTool[] {
  switch (imageType) {
    case 'image/png':
      return toolsCollections.png
    case 'image/gif':
      return toolsCollections.gif
    case 'image/webp':
      return toolsCollections.webp
    case 'image/jpeg':
      return toolsCollections.jpeg
  }
}

function imageTypeToFormat(imageType: ImageType): ImageFormat {
  switch (imageType) {
    case 'image/jpeg':
      return 'jpeg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
  }
}

function normalizeSharpFormat(format?: string): ImageFormat | undefined {
  if (format === 'jpg')
    return 'jpeg'

  if (format === 'jpeg' || format === 'png' || format === 'webp' || format === 'gif' || format === 'avif')
    return format

  return undefined
}

function mimeTypeForFormat(format: ImageFormat): string {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`
}

function extensionForFormat(format: ImageFormat): string {
  return format === 'jpeg' ? 'jpg' : format
}

function extensionToFormat(extension: string): ImageFormat | undefined {
  const normalized = extension.replace(/^\./, '').toLowerCase()
  if (normalized === 'jpg' || normalized === 'jpeg')
    return 'jpeg'
  if (normalized === 'png' || normalized === 'webp' || normalized === 'gif' || normalized === 'avif')
    return normalized
  return undefined
}

function compressionRatio(originalSize: number, compressedSize: number): number {
  return ((originalSize - compressedSize) / originalSize) * 100
}

function getTinifyApiKey(toolConfigs?: ToolConfig[]): string | undefined {
  const tinifyConfig = toolConfigs?.find(config => config.name === 'tinify')
  return typeof tinifyConfig?.key === 'string' ? tinifyConfig.key : process.env.TINIFY_API_KEY
}

async function readBatchManifest(cacheFile: string): Promise<StoredBatchManifest> {
  try {
    const manifest = JSON.parse(await fs.readFile(cacheFile, 'utf8')) as StoredBatchManifest
    return manifest.version === 1 && manifest.entries
      ? manifest
      : { version: 1, entries: {} }
  }
  catch {
    return { version: 1, entries: {} }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function hashString(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function validateQuality(quality: unknown): void {
  if (quality === undefined)
    return

  if (typeof quality !== 'number' || !Number.isFinite(quality) || quality < 0 || quality > 1) {
    throw new RangeError('Invalid quality value: quality must be a number between 0 and 1')
  }
}

function validateResultType(type: unknown): void {
  if (type !== 'buffer' && type !== 'base64' && type !== 'blob' && type !== 'file') {
    throw new RangeError('Invalid result type: type must be one of buffer, base64, blob, or file')
  }
}

function validateDimensions(options: Pick<CompressionStatsOptions, 'maxHeight' | 'maxWidth' | 'targetHeight' | 'targetWidth'>): void {
  const fields = ['targetWidth', 'targetHeight', 'maxWidth', 'maxHeight'] as const

  for (const field of fields) {
    const value = options[field]
    if (value === undefined)
      continue

    if (!Number.isInteger(value) || value <= 0) {
      throw new RangeError(`Invalid ${field} value: ${field} must be a positive integer`)
    }
  }
}

function validateBooleanOption(value: unknown, name: string): void {
  if (value === undefined)
    return

  if (typeof value !== 'boolean') {
    throw new TypeError(`Invalid ${name} value: ${name} must be a boolean`)
  }
}

function validateToolConfigs(toolConfigs: unknown): void {
  if (toolConfigs === undefined)
    return

  if (!Array.isArray(toolConfigs)) {
    throw new TypeError('Invalid toolConfigs value: toolConfigs must be an array')
  }

  for (const config of toolConfigs) {
    if (!config || typeof config !== 'object' || typeof (config as ToolConfig).name !== 'string') {
      throw new TypeError('Invalid toolConfigs item: each config must be an object with a string name')
    }
  }
}

function validateMetadataMode(metadata: unknown): void {
  if (metadata === undefined)
    return

  if (!supportedMetadataModes.includes(metadata as MetadataMode)) {
    throw new RangeError('Invalid metadata value: metadata must be one of strip, exif, or all')
  }
}

function validateOutputFormat(format: unknown): void {
  if (format === undefined)
    return

  if (!supportedOutputFormats.includes(format as OutputImageFormat)) {
    throw new RangeError('Invalid format value: format must be one of same, auto, jpeg, png, webp, avif, or gif')
  }
}

function validateTargetBytes(targetBytes: unknown): void {
  if (targetBytes === undefined)
    return

  if (typeof targetBytes !== 'number' || !Number.isInteger(targetBytes) || targetBytes <= 0) {
    throw new RangeError('Invalid targetBytes value: targetBytes must be a positive integer')
  }
}

function validateStrategy(strategy: unknown): void {
  if (strategy === undefined)
    return

  if (!supportedStrategies.includes(strategy as CompressStrategy)) {
    throw new RangeError('Invalid strategy value: strategy must be one of smallest, balanced, preserveFormat, or targetSize')
  }
}

function validateVariantFormats(formats: unknown): void {
  if (!Array.isArray(formats) || formats.length === 0) {
    throw new TypeError('Invalid formats value: formats must be a non-empty array')
  }

  for (const format of formats) {
    validateOutputFormat(format)
  }
}

function validateCompressFilesOptions(inputPaths: string[], options: CompressFilesOptions): void {
  if (!Array.isArray(inputPaths) || inputPaths.length === 0 || inputPaths.some(inputPath => typeof inputPath !== 'string')) {
    throw new TypeError('Invalid inputPaths value: inputPaths must be a non-empty string array')
  }

  if (!options || typeof options !== 'object' || typeof options.outputDir !== 'string') {
    throw new TypeError('Invalid compressFiles options: outputDir must be a string')
  }

  if (options.concurrency !== undefined && (!Number.isInteger(options.concurrency) || options.concurrency <= 0)) {
    throw new RangeError('Invalid concurrency value: concurrency must be a positive integer')
  }

  validateQuality(options.quality)
  validateDimensions(options)
  validateBooleanOption(options.preserveExif, 'preserveExif')
  validateToolConfigs(options.toolConfigs)
  validateMetadataMode(options.metadata)
  validateOutputFormat(options.format)
  validateTargetBytes(options.targetBytes)
  validateStrategy(options.strategy)
}

export type {
  BlobInterface,
  CompressFileResult,
  CompressFilesOptions,
  CompressionStats,
  CompressionStatsOptions,
  CompressOptions,
  CompressorCapabilities,
  CompressorTool,
  CompressResult,
  CompressResultItem,
  CompressResultType,
  CompressStrategy,
  CompressVariantResult,
  CompressVariantsOptions,
  DetailedCompressionResult,
  FileInterface,
  ImageFormat,
  ImageMetadata,
  MetadataMode,
  MultipleCompressResults,
  OutputImageFormat,
  ToolAvailability,
  ToolConfig,
}

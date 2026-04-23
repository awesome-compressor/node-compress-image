# Node Compress Image

一个集成多个Node.js压缩库的通用图像压缩工具，自动选择最优压缩结果。

Node.js image compressor and image optimizer for JPEG, PNG, WebP and AVIF. Suitable for SEO image optimization, Core Web Vitals, responsive images, static site builds, CMS uploads and asset pipelines.

## 特性

- 🚀 **多工具集成**: 支持 Sharp、ImageMin、JIMP、Tinify 四种主流压缩工具
- 🎯 **智能选择**: 自动比对多个工具的压缩结果，返回最优压缩效果
- 📊 **详细统计**: 提供压缩时间、压缩率、工具性能等详细统计信息
- 🔧 **灵活配置**: 支持质量、尺寸等多种压缩选项
- 📦 **按需安装**: JIMP 和 Tinify 为可选 peer dependency，可以只使用 Sharp 和 ImageMin 核心功能
- 🔄 **多种输出**: 支持 Buffer、Base64、Blob、File 等多种输出格式
- 🔍 **向后兼容**: 支持传统参数格式，平滑迁移
- 🌐 **格式齐全**: 支持 JPEG、PNG、WebP、GIF 等主流图像格式
- 🧭 **SEO 友好**: 支持 WebP / AVIF 变体、目标体积、批处理缓存和可解释压缩结果

## 适用场景

- 网站首屏图、文章封面、商品图、头像等静态资源优化
- 为 `<picture>` 生成 AVIF / WebP / JPEG fallback，提高 LCP 和 Core Web Vitals 表现
- CMS 上传链路中按目标体积压缩图片，避免用户上传超大图
- 静态站点或文档站构建时批量压缩图片，并通过缓存跳过未变化文件
- 需要保留版权/拍摄信息时，只让支持元数据的工具参与压缩

## 安装

需要 Node.js 18.17 或更高版本。

```bash
npm install @awesome-compressor/node-compress-image
```

npm 搜索关键词：`node image compression`、`image optimizer`、`sharp imagemin`、`webp avif`、`seo image optimization`。

### 安装可选工具

```bash
# 基础工具（已包含在核心依赖中）
# Sharp - 高性能图像处理
# ImageMin - 专业图像优化

# 可选工具
npm install jimp                # 纯 JavaScript 实现，无系统依赖
npm install tinify              # TinyPNG/TinyJPG 官方 API，需要 API 密钥
```

## 快速开始

```typescript
import fs from 'node:fs'
import {
  compress,
  compressDetailed,
  compressFiles,
  compressVariants,
  compressWithStats,
  getCapabilities,
} from '@awesome-compressor/node-compress-image'

// 基础使用
const imageBuffer = fs.readFileSync('input.jpg')
const compressedBuffer = await compress(imageBuffer, { quality: 0.8 })
fs.writeFileSync('output.jpg', compressedBuffer)

// 获取详细统计信息
const stats = await compressWithStats(imageBuffer, { quality: 0.8 })
console.log(`最佳工具: ${stats.bestTool}`)
console.log(`压缩率: ${stats.compressionRatio.toFixed(1)}%`)
console.log(`总耗时: ${stats.totalDuration}ms`)
```

## API

### compress(file, options)

主压缩函数，支持多种重载形式。

#### 参数

- `file`: `Buffer | FileInterface | BlobInterface` - 输入的图像文件
- `options`: `CompressOptions` - 压缩选项

#### CompressOptions

```typescript
interface ToolConfig {
  name: string
  key?: string
  [key: string]: any
}

interface CompressOptions<T extends 'buffer' | 'base64' | 'blob' | 'file' = 'buffer' | 'base64' | 'blob' | 'file'> {
  quality?: number // 压缩质量 0-1，默认 0.6
  targetWidth?: number // 目标宽度
  targetHeight?: number // 目标高度
  maxWidth?: number // 最大宽度
  maxHeight?: number // 最大高度
  preserveExif?: boolean // 尝试保留EXIF信息，默认 false；目前仅 Sharp 生效
  metadata?: 'strip' | 'exif' | 'all' // 元数据策略，默认 'strip'
  format?: 'same' | 'auto' | 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' // 输出格式
  targetBytes?: number // 目标输出体积
  strategy?: 'smallest' | 'balanced' | 'preserveFormat' | 'targetSize' // 结果选择策略
  returnAllResults?: boolean // 是否返回所有工具结果，默认 false
  type?: T // 返回类型，默认 'buffer'
  toolConfigs?: ToolConfig[] // 工具特定配置，例如 Tinify API key
}

type CompressionStatsOptions = Omit<CompressOptions, 'returnAllResults' | 'type'>
```

#### 示例

```typescript
// 基础压缩
const compressed = await compress(imageBuffer, { quality: 0.8 })

// 调整尺寸
const resized = await compress(imageBuffer, {
  quality: 0.8,
  maxWidth: 800,
  maxHeight: 600
})

// 返回Base64格式
const base64 = await compress(imageBuffer, {
  quality: 0.8,
  type: 'base64'
})

// 获取所有工具的压缩结果
const allResults = await compress(imageBuffer, {
  quality: 0.8,
  returnAllResults: true
})

console.log('最佳结果:', allResults.bestResult)
console.log('最佳工具:', allResults.bestTool)
console.log('所有结果:', allResults.allResults)

// 转换输出格式
const webp = await compress(imageBuffer, {
  quality: 0.8,
  format: 'webp'
})

// 生成多格式变体
const variants = await compressVariants(imageBuffer, {
  quality: 0.8,
  formats: ['webp', 'avif']
})
```

## SEO 图片优化

图片 SEO 不只是压缩体积，还包括稳定的输出格式、合理尺寸、现代格式 fallback、文件名语义和可缓存构建结果。这个库负责图片二进制优化，`alt` 文案、页面结构和 CDN 缓存策略仍应在业务层处理。

### 生成 `<picture>` 多格式资源

```typescript
import fs from 'node:fs/promises'
import { compressDetailed, compressVariants } from '@awesome-compressor/node-compress-image'

const input = await fs.readFile('./assets/hero-original.jpg')
const baseName = 'modern-office-dashboard'

const fallback = await compressDetailed(input, {
  quality: 0.82,
  maxWidth: 1200,
  format: 'jpeg',
  targetBytes: 220 * 1024,
  metadata: 'strip'
})

const variants = await compressVariants(input, {
  quality: 0.82,
  maxWidth: 1200,
  formats: ['avif', 'webp'],
  type: 'buffer',
  metadata: 'strip'
})

await fs.mkdir('./public/images', { recursive: true })
await fs.writeFile(`./public/images/${baseName}.jpg`, fallback.output)

for (const variant of variants) {
  await fs.writeFile(`./public/images/${baseName}.${variant.format}`, variant.result.output)
}

const picture = `
<picture>
  <source srcset="/images/${baseName}.avif" type="image/avif">
  <source srcset="/images/${baseName}.webp" type="image/webp">
  <img
    src="/images/${baseName}.jpg"
    width="${fallback.metadata.output.width ?? 1200}"
    height="${fallback.metadata.output.height ?? 630}"
    alt="Modern office dashboard analytics"
    loading="lazy"
    decoding="async"
  >
</picture>`

console.log(picture)
```

### 按目标体积处理 CMS 上传图

```typescript
import { compressDetailed } from '@awesome-compressor/node-compress-image'

const result = await compressDetailed(uploadedImageBuffer, {
  quality: 0.9,
  maxWidth: 1600,
  targetBytes: 300 * 1024,
  strategy: 'targetSize',
  format: 'auto',
  metadata: 'strip'
})

console.log(result.format)
console.log(result.compressedSize)
console.log(result.selectedReason)
console.log(result.warnings)
```

### 静态站点构建时批量压缩

```typescript
import { glob } from 'node:fs/promises'
import { compressFiles } from '@awesome-compressor/node-compress-image'

const inputFiles = []

for await (const file of glob('./content/**/*.{jpg,jpeg,png,webp}')) {
  inputFiles.push(file)
}

const results = await compressFiles(inputFiles, {
  outputDir: './public/images',
  cacheFile: './public/images/.compress-cache.json',
  quality: 0.82,
  maxWidth: 1600,
  format: 'webp',
  concurrency: 4,
  metadata: 'strip'
})

console.table(results.map(result => ({
  file: result.inputPath,
  output: result.outputPath,
  skipped: result.skipped,
  size: result.compressedSize,
  reason: result.selectedReason
})))
```

### SEO 图片优化检查清单

- 优先为大图生成 AVIF / WebP，同时保留 JPEG 或 PNG fallback。
- 输出图片宽高应匹配页面实际展示尺寸，避免浏览器下载后再缩小。
- 对首屏图控制目标体积，例如 `targetBytes: 200 * 1024`。
- 文件名使用可读语义，例如 `product-dashboard-analytics.webp`，不要只用哈希。
- 页面层必须提供准确 `alt`，库不会自动生成文案。
- 默认使用 `metadata: 'strip'` 减少体积；需要版权或拍摄信息时使用 `metadata: 'exif'` 或 `metadata: 'all'`。
- 批处理构建应启用 `cacheFile`，避免 CI/CD 每次重复压缩未变化图片。

### 能力探测

```typescript
const capabilities = await getCapabilities()

console.log(capabilities.inputFormats)
console.log(capabilities.outputFormats)
console.log(capabilities.tools)
```

`getCapabilities()` 会返回当前环境里各工具是否安装、是否完成配置、支持哪些输入/输出格式、是否支持质量、尺寸和元数据能力。Tinify 只有在安装依赖并提供 API key 后才会标记为 configured。

### quality 语义

`quality` 是 0 到 1 的统一入口，超出范围会抛错。各工具会按自身能力映射：

| 工具 | 映射方式 |
|------|----------|
| Sharp | JPEG / PNG / WebP 映射为 1-100；`preserveExif` 仅通过 Sharp 生效 |
| ImageMin | JPEG 使用 mozjpeg quality，PNG 使用 pngquant quality，WebP 使用 webp quality，GIF 映射为颜色数 |
| JIMP | 映射为 JIMP quality，主要影响 JPEG 输出 |
| Tinify | TinyPNG API 自动决策，`quality` 不保证直接生效 |

未识别的输入格式会直接抛错，不会再默认当作 JPEG 处理。

### 输出格式

`format` 控制输出格式：

| 值 | 说明 |
|----|------|
| `same` | 保持工具输出格式，默认值 |
| `jpeg` / `png` / `webp` / `avif` / `gif` | 强制输出指定格式 |
| `auto` | 在原格式、WebP、AVIF 中选择体积最小的结果 |

`compressVariants()` 用于一次生成多个格式变体，适合 Web 服务同时产出 WebP / AVIF fallback。

### 尺寸参数

`targetWidth`、`targetHeight`、`maxWidth`、`maxHeight` 必须是正整数，非法值会抛错，避免不同压缩引擎各自处理出不一致的结果。

### 选项校验

`preserveExif` 和 `returnAllResults` 必须是布尔值，`toolConfigs` 必须是数组。`compressWithStats()` 不支持 `type` 或 `returnAllResults`，因为它固定返回统计对象。

### 结果选择策略

默认策略是从成功的工具结果中选择文件体积最小的一项。失败的工具不会参与最佳结果选择，但在 `returnAllResults: true` 时会保留在 `allResults` 中并标记 `success: false`。

如果所有工具都失败，库会返回原始输入，`returnAllResults` 和 `compressWithStats` 的 `bestTool` 会标记为 `original`。如果最佳结果与原图大小接近，并且 `quality > 0.85`，库也会保留原图，避免高质量场景下产生几乎无收益的重编码结果。

可选策略：

| 策略 | 说明 |
|------|------|
| `smallest` | 选择体积最小的成功结果 |
| `balanced` | 在最小体积 10% 范围内选择最快结果 |
| `preserveFormat` | 优先选择保持原格式的最小结果 |
| `targetSize` | 配合 `targetBytes`，优先选择不超过目标体积且最接近目标的结果 |

### 目标体积

```typescript
const result = await compressDetailed(imageBuffer, {
  quality: 0.9,
  targetBytes: 200 * 1024
})

console.log(result.selectedReason)
```

设置 `targetBytes` 后，库会对支持质量参数的工具尝试多轮质量搜索；如果没有结果满足目标体积，会返回当前可得到的最小结果，并在 `selectedReason` 中说明原因。

### compressDetailed(file, options)

返回完整、可解释的压缩结果：

```typescript
const detailed = await compressDetailed(imageBuffer, {
  quality: 0.8,
  strategy: 'balanced',
  metadata: 'strip'
})

console.log(detailed.output)
console.log(detailed.bestTool)
console.log(detailed.format)
console.log(detailed.selectedReason)
console.log(detailed.metadata.output)
console.log(detailed.warnings)
```

### compressWithStats(file, options)

带详细统计信息的压缩函数。它固定返回 `CompressionStats`，其中 `compressedFile` 始终是 `BlobInterface`；不要传 `type`。

```typescript
const stats = await compressWithStats(imageBuffer, { quality: 0.8 })

console.log('压缩统计:')
console.log(`最佳工具: ${stats.bestTool}`)
console.log(`原始大小: ${stats.originalSize} bytes`)
console.log(`压缩大小: ${stats.compressedSize} bytes`)
console.log(`压缩率: ${stats.compressionRatio.toFixed(1)}%`)
console.log(`总耗时: ${stats.totalDuration}ms`)

console.log('各工具性能:')
stats.toolsUsed.forEach((tool) => {
  console.log(`${tool.tool}: ${tool.size} bytes, ${tool.duration}ms, ${tool.compressionRatio.toFixed(1)}%`)
})
```

## 支持的工具

| 工具 | 描述 | 优势 | 自动选择中参与的格式 |
|------|------|------|----------|
| Sharp | 高性能图像处理库 | 速度快，质量高 | JPEG, PNG, WebP |
| ImageMin | 专业图像优化工具 | 插件生态丰富，支持多格式优化 | JPEG, PNG, WebP, GIF |
| JIMP | 纯JavaScript图像处理 | 无二进制依赖 | JPEG |
| Tinify | TinyPNG/TinyJPG官方API | 智能有损压缩，压缩率高 | JPEG, PNG, WebP |

### Tinify 配置

Tinify 需要API密钥才能使用。你可以通过以下方式配置：

1. **通过环境变量**:
```bash
export TINIFY_API_KEY="your-api-key-here"
```

2. **通过参数传递**:
```typescript
const result = await compress(imageBuffer, {
  quality: 0.8,
  toolConfigs: [
    {
      name: 'tinify',
      key: 'your-api-key-here'
    }
  ]
})
```

获取API密钥: [TinyPNG Developer API](https://tinypng.com/developers)

### 元数据策略

`metadata` 支持：

| 值 | 说明 |
|----|------|
| `strip` | 默认，剥离元数据 |
| `exif` | 尽量保留 EXIF，目前通过 Sharp 实现 |
| `all` | 尽量保留 EXIF / ICC / XMP / IPTC，目前通过 Sharp 实现 |

`preserveExif` 仍然兼容旧用法，内部等价于 `metadata: 'exif'`。启用元数据保留时，库会只使用支持该能力的工具参与压缩选择。

### 批处理与缓存

```typescript
const results = await compressFiles(['./input/a.jpg', './input/b.png'], {
  outputDir: './dist/images',
  cacheFile: './dist/images/.compress-cache.json',
  quality: 0.8,
  format: 'webp',
  concurrency: 4
})

console.log(results)
```

`compressFiles()` 会写入 `outputDir`，并可通过 `cacheFile` 跳过输入内容和关键选项都未变化的文件。

## 工具选择策略

库会根据图像类型自动选择最适合的工具组合：

- **PNG**: Sharp → ImageMin → Tinify
- **JPEG**: Sharp → ImageMin → JIMP → Tinify
- **WebP**: Sharp → ImageMin → Tinify
- **GIF**: ImageMin

## 性能优势

- **并行处理**: 多个工具同时运行，提高效率
- **智能选择**: 自动选择压缩效果最佳的结果
- **轻量级**: JIMP 和 Tinify 按需安装，减小默认安装体积
- **失败恢复**: 某个工具失败时自动使用其他工具
- **灵活配置**: 支持工具特定的配置参数

## :coffee:

[buy me a cup of coffee](https://github.com/Simon-He95/sponsor)

## License

[MIT](./license)

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.png"/>
  </a>
</p>

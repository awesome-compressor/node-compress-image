# Node Image Compression

一个集成多个Node.js压缩库的通用图像压缩工具，自动选择最优压缩结果。

## 特性

- 🚀 **多工具集成**: 支持 Sharp、JIMP、Canvas、Imagemin、Squoosh 等多种压缩工具
- 🎯 **智能选择**: 自动比对多个工具的压缩结果，返回最优压缩效果
- 📊 **详细统计**: 提供压缩时间、压缩率、工具性能等详细统计信息
- 🔧 **灵活配置**: 支持质量、尺寸、EXIF保留等多种压缩选项
- 📦 **按需安装**: 所有压缩工具均为可选依赖，按需安装使用
- 🔄 **多种输出**: 支持 Buffer、Base64、Blob、File 等多种输出格式
- 🔍 **向后兼容**: 支持传统参数格式，平滑迁移

## 安装

```bash
npm install node-image-compression
```

### 安装压缩工具（可选）

根据需要安装对应的压缩工具：

```bash
# Sharp - 推荐，性能最佳
npm install sharp

# JIMP - 纯JavaScript实现
npm install jimp

# Canvas - Node.js Canvas API
npm install canvas

# Imagemin 系列 - 专业图像优化
npm install imagemin imagemin-mozjpeg imagemin-pngquant imagemin-webp imagemin-gifsicle

# Squoosh - Google开源压缩库
npm install @squoosh/lib
```

## 快速开始

```typescript
import fs from 'node:fs'
import compress, { compressWithStats } from 'node-image-compression'

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
interface CompressOptions {
  quality?: number // 压缩质量 0-1，默认 0.6
  mode?: 'keepSize' | 'keepQuality' // 压缩模式，默认 'keepSize'
  targetWidth?: number // 目标宽度
  targetHeight?: number // 目标高度
  maxWidth?: number // 最大宽度
  maxHeight?: number // 最大高度
  preserveExif?: boolean // 是否保留EXIF信息，默认 false
  returnAllResults?: boolean // 是否返回所有工具结果，默认 false
  type?: 'buffer' | 'base64' | 'blob' | 'file' // 返回类型，默认 'buffer'
}
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

// 保留EXIF信息
const withExif = await compress(imageBuffer, {
  quality: 0.8,
  preserveExif: true
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
```

### compressWithStats(file, options)

带详细统计信息的压缩函数。

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

| 工具 | 描述 | 优势 | 支持格式 |
|------|------|------|----------|
| Sharp | 高性能图像处理库 | 速度快，质量高 | JPEG, PNG, WebP, GIF |
| JIMP | 纯JavaScript图像处理 | 无二进制依赖 | JPEG, PNG, BMP, TIFF, GIF |
| Canvas | Node.js Canvas API | HTML5 Canvas兼容 | JPEG, PNG, WebP |
| Imagemin | 专业图像优化工具集 | 专业优化算法 | JPEG, PNG, WebP, GIF |
| Squoosh | Google开源压缩库 | 现代压缩算法 | JPEG, PNG, WebP |

## 工具选择策略

库会根据图像类型自动选择最适合的工具组合：

- **PNG**: Sharp → Imagemin → Squoosh → JIMP → Canvas
- **JPEG**: Sharp → Imagemin → Squoosh → JIMP → Canvas
- **WebP**: Sharp → Squoosh → Imagemin → Canvas
- **GIF**: Imagemin → Squoosh
- **其他**: Sharp → Imagemin → Squoosh → JIMP → Canvas

## 性能优势

- **并行处理**: 所有工具同时运行，提高效率
- **智能选择**: 自动选择压缩效果最佳的结果
- **可选依赖**: 只安装需要的工具，减小包体积
- **失败恢复**: 某个工具失败时自动使用其他工具

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

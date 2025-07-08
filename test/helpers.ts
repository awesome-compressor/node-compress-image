import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ESM模块中获取__dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 创建测试PNG图像数据 (1x1像素)
export function createTestPNG(): Buffer {
  return Buffer.from([
    0x89,
    0x50,
    0x4E,
    0x47,
    0x0D,
    0x0A,
    0x1A,
    0x0A, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0D, // IHDR chunk length
    0x49,
    0x48,
    0x44,
    0x52, // IHDR
    0x00,
    0x00,
    0x00,
    0x01, // width: 1
    0x00,
    0x00,
    0x00,
    0x01, // height: 1
    0x08,
    0x02,
    0x00,
    0x00,
    0x00, // bit depth, color type, compression, filter, interlace
    0x90,
    0x77,
    0x53,
    0xDE, // CRC
    0x00,
    0x00,
    0x00,
    0x0C, // IDAT chunk length
    0x49,
    0x44,
    0x41,
    0x54, // IDAT
    0x08,
    0x99,
    0x01,
    0x01,
    0x00,
    0x00,
    0x00,
    0xFF,
    0xFF,
    0x00,
    0x00,
    0x00,
    0x02,
    0x00,
    0x01,
    0x73,
    0x75,
    0x01,
    0x18, // IDAT data + CRC
    0x00,
    0x00,
    0x00,
    0x00, // IEND chunk length
    0x49,
    0x45,
    0x4E,
    0x44, // IEND
    0xAE,
    0x42,
    0x60,
    0x82, // IEND CRC
  ])
}

// 创建测试JPEG图像数据 (使用最简单的有效JPEG)
export function createTestJPEG(): Buffer {
  // 使用一个最小的有效1x1像素黑色JPEG
  return Buffer.from([
    0xFF,
    0xD8, // SOI
    0xFF,
    0xE0,
    0x00,
    0x10,
    0x4A,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x01,
    0x00,
    0x48,
    0x00,
    0x48,
    0x00,
    0x00, // APP0
    0xFF,
    0xDB,
    0x00,
    0x43,
    0x00, // DQT
    0x08,
    0x06,
    0x06,
    0x07,
    0x06,
    0x05,
    0x08,
    0x07,
    0x07,
    0x07,
    0x09,
    0x09,
    0x08,
    0x0A,
    0x0C,
    0x14,
    0x0D,
    0x0C,
    0x0B,
    0x0B,
    0x0C,
    0x19,
    0x12,
    0x13,
    0x0F,
    0x14,
    0x1D,
    0x1A,
    0x1F,
    0x1E,
    0x1D,
    0x1A,
    0x1C,
    0x1C,
    0x20,
    0x24,
    0x2E,
    0x27,
    0x20,
    0x22,
    0x2C,
    0x23,
    0x1C,
    0x1C,
    0x28,
    0x37,
    0x29,
    0x2C,
    0x30,
    0x31,
    0x34,
    0x34,
    0x34,
    0x1F,
    0x27,
    0x39,
    0x3D,
    0x38,
    0x32,
    0x3C,
    0x2E,
    0x33,
    0x34,
    0x32,
    0xFF,
    0xC0,
    0x00,
    0x11,
    0x08,
    0x00,
    0x01,
    0x00,
    0x01,
    0x01,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01, // SOF0
    0xFF,
    0xC4,
    0x00,
    0x15,
    0x00,
    0x01,
    0x01,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x08, // DHT
    0xFF,
    0xC4,
    0x00,
    0x14,
    0x10,
    0x01,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00, // DHT
    0xFF,
    0xDA,
    0x00,
    0x0C,
    0x03,
    0x01,
    0x00,
    0x02,
    0x11,
    0x03,
    0x11,
    0x00,
    0x3F,
    0x00,
    0x00, // SOS
    0xFF,
    0xD9, // EOI
  ])
}

// 获取测试图像
export function getTestImage(): Buffer {
  const iconPath = path.join(__dirname, 'icon.png')

  if (fs.existsSync(iconPath)) {
    return fs.readFileSync(iconPath)
  }

  return createTestPNG()
}

// 获取测试PNG图像
export function getTestPNG(): Buffer {
  const iconPath = path.join(__dirname, 'icon.png')

  if (fs.existsSync(iconPath)) {
    return fs.readFileSync(iconPath)
  }

  return createTestPNG()
}

// 获取测试JPEG图像
export function getTestJPEG(): Buffer {
  const jpegPath = path.join(__dirname, 'icon.jpeg')

  if (fs.existsSync(jpegPath)) {
    return fs.readFileSync(jpegPath)
  }

  // 如果文件不存在，返回手工创建的JPEG
  return createTestJPEG()
}

// 获取测试GIF图像
export function getTestGIF(): Buffer {
  const gifPath = path.join(__dirname, 'icon.gif')

  if (fs.existsSync(gifPath)) {
    return fs.readFileSync(gifPath)
  }

  // 如果文件不存在，抛出错误
  throw new Error('Test GIF file not found')
}

// 根据格式获取测试图像
export function getTestImageByFormat(format: 'png' | 'jpeg' | 'gif'): Buffer {
  switch (format) {
    case 'png':
      return getTestPNG()
    case 'jpeg':
      return getTestJPEG()
    case 'gif':
      return getTestGIF()
    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

// 测试输出目录
export function getOutputDir(): string {
  return path.join(__dirname, 'output')
}

// 确保输出目录存在
export function ensureOutputDir(): void {
  const outputDir = getOutputDir()
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
}

// 保存测试结果
export function saveTestResult(filename: string, buffer: Buffer): void {
  ensureOutputDir()
  const outputPath = path.join(getOutputDir(), filename)
  fs.writeFileSync(outputPath, buffer)
}

// 通用压缩选项
export const defaultOptions = {
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1080,
}

// 检查Buffer是否有效
export function isValidBuffer(buffer: Buffer): boolean {
  return Buffer.isBuffer(buffer) && buffer.length > 0
}

// 工具可用性检查
export async function isToolAvailable(toolName: string): Promise<boolean> {
  try {
    switch (toolName) {
      case 'jimp':
        await import('jimp')
        return true
      case 'imagemin':
        await import('imagemin')
        return true
      case 'sharp':
        await import('sharp')
        return true
      default:
        return false
    }
  }
  catch {
    return false
  }
}

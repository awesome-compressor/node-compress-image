import type { BlobInterface, CompressResult, CompressResultType, FileInterface } from './types'

// Buffer转Blob
export function bufferToBlob(buffer: Buffer, type = 'image/png'): BlobInterface {
  const data = Buffer.from(buffer)

  return {
    size: data.length,
    type,
    async arrayBuffer() {
      return bufferToArrayBuffer(data)
    },
  }
}

// Buffer转Base64
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64')
}

// Buffer转File
export function bufferToFile(buffer: Buffer, fileName = 'compressed', type = 'image/png'): FileInterface {
  const data = Buffer.from(buffer)

  return {
    name: fileName,
    size: data.length,
    type,
    async arrayBuffer() {
      return bufferToArrayBuffer(data)
    },
  }
}

// 将Buffer转换为指定类型
export async function convertBufferToType<T extends CompressResultType>(
  buffer: Buffer,
  type: T,
  fileName?: string,
): Promise<CompressResult<T>> {
  const mimeType = getMimeTypeFromBuffer(buffer) || getMimeTypeFromFileName(fileName) || 'application/octet-stream'

  switch (type) {
    case 'buffer':
      return buffer as CompressResult<T>
    case 'base64':
      return bufferToBase64(buffer) as CompressResult<T>
    case 'blob':
      return bufferToBlob(buffer, mimeType) as CompressResult<T>
    case 'file':
      return bufferToFile(buffer, fileName, mimeType) as CompressResult<T>
    default:
      throw new RangeError('Invalid result type: type must be one of buffer, base64, blob, or file')
  }
}

// 从文件名推断MIME类型
function getMimeTypeFromFileName(fileName?: string): string | undefined {
  if (!fileName)
    return undefined

  const ext = fileName.toLowerCase().split('.').pop()
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    svg: 'image/svg+xml',
  }

  return ext ? mimeTypes[ext] : undefined
}

function getMimeTypeFromBuffer(buffer: Buffer): string | undefined {
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return 'image/png'
  }

  if (buffer.slice(0, 2).equals(Buffer.from([0xFF, 0xD8]))) {
    return 'image/jpeg'
  }

  if (buffer.slice(0, 4).equals(Buffer.from('RIFF', 'ascii'))
    && buffer.slice(8, 12).equals(Buffer.from('WEBP', 'ascii'))) {
    return 'image/webp'
  }

  if (buffer.slice(0, 6).equals(Buffer.from('GIF87a', 'ascii'))
    || buffer.slice(0, 6).equals(Buffer.from('GIF89a', 'ascii'))) {
    return 'image/gif'
  }

  return undefined
}

// 从File或Blob获取Buffer
export async function getBufferFromFile(file: FileInterface | BlobInterface): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(arrayBuffer).set(buffer)
  return arrayBuffer
}

import type { BlobInterface, CompressResult, CompressResultType, FileInterface } from './types'

// Buffer转Blob
export function bufferToBlob(buffer: Buffer, type = 'image/png'): BlobInterface {
  return {
    size: buffer.length,
    type,
    async arrayBuffer() {
      return new ArrayBuffer(buffer.byteLength)
    },
  }
}

// Buffer转Base64
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64')
}

// Buffer转File
export function bufferToFile(buffer: Buffer, fileName = 'compressed', type = 'image/png'): FileInterface {
  return {
    name: fileName,
    size: buffer.length,
    type,
    async arrayBuffer() {
      return new ArrayBuffer(buffer.byteLength)
    },
  }
}

// 将Buffer转换为指定类型
export async function convertBufferToType<T extends CompressResultType>(
  buffer: Buffer,
  type: T,
  fileName?: string,
): Promise<CompressResult<T>> {
  const mimeType = getMimeTypeFromFileName(fileName) || 'image/png'

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
      return bufferToBlob(buffer, mimeType) as CompressResult<T>
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

// 从File或Blob获取Buffer
export async function getBufferFromFile(file: FileInterface | BlobInterface): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

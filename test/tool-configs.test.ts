import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compress } from '../src/index'
import { createTestPNG } from './helpers'

const tinifyMock = vi.hoisted(() => ({
  api: {
    key: '',
    fromBuffer: vi.fn(() => ({
      toBuffer(callback: (error: Error | null, result?: Buffer) => void) {
        callback(null, Buffer.from([0x89, 0x50, 0x4E, 0x47]))
      },
    })),
  },
}))

vi.mock('tinify', () => ({
  default: tinifyMock.api,
}))

describe('toolConfigs', () => {
  beforeEach(() => {
    delete process.env.TINIFY_API_KEY
    tinifyMock.api.key = ''
    tinifyMock.api.fromBuffer.mockClear()
  })

  it('should pass tinify config through compress options', async () => {
    const results = await compress(createTestPNG(), {
      quality: 0.8,
      returnAllResults: true,
      toolConfigs: [
        {
          name: 'tinify',
          key: 'test-key',
        },
      ],
    })

    const tinifyResult = results.allResults.find(result => result.tool === 'tinify')

    expect(tinifyMock.api.key).toBe('test-key')
    expect(tinifyMock.api.fromBuffer).toHaveBeenCalledOnce()
    expect(tinifyResult?.success).toBe(true)
  })
})

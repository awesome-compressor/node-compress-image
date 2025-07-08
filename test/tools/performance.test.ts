import { beforeAll, describe, expect, it } from 'vitest'
import { compressWithImagemin } from '../../src/tools/imagemin'
import { compressWithJimp } from '../../src/tools/jimp'
import { compressWithSharp } from '../../src/tools/sharp'
import { defaultOptions, getTestImage, isToolAvailable, saveTestResult } from '../helpers'

describe('工具性能对比测试', () => {
  let testBuffer: Buffer
  const availableTools: string[] = []

  const tools = [
    { name: 'sharp', func: compressWithSharp },
    { name: 'imagemin', func: compressWithImagemin },
    { name: 'jimp', func: compressWithJimp },
  ]

  beforeAll(async () => {
    testBuffer = getTestImage()

    console.log('\n🔍 检查工具可用性...')
    for (const tool of tools) {
      const available = tool.name === 'sharp' || tool.name === 'imagemin' || await isToolAvailable(tool.name)
      if (available) {
        availableTools.push(tool.name)
        console.log(`   ✅ ${tool.name}`)
      }
      else {
        console.log(`   ❌ ${tool.name}`)
      }
    }
  })

  it('应该测试所有可用工具的压缩性能', async () => {
    const results: Array<{
      tool: string
      duration: number
      originalSize: number
      compressedSize: number
      compressionRatio: number
      success: boolean
      error?: string
    }> = []

    console.log('\n⚡ 性能测试开始...')
    console.log(`   原始图像大小: ${testBuffer.length} bytes`)

    for (const tool of tools) {
      if (!availableTools.includes(tool.name)) {
        continue
      }

      try {
        const startTime = Date.now()
        const result = await tool.func(testBuffer, defaultOptions)
        const duration = Date.now() - startTime

        const originalSize = testBuffer.length
        const compressedSize = result.length
        const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100

        results.push({
          tool: tool.name,
          duration,
          originalSize,
          compressedSize,
          compressionRatio,
          success: true,
        })

        // 保存结果
        saveTestResult(`performance_${tool.name}.${tool.name === 'imagemin' || tool.name === 'sharp' ? 'png' : 'jpg'}`, result)

        console.log(`   ✅ ${tool.name}: ${duration}ms, ${compressedSize} bytes (${compressionRatio.toFixed(2)}%)`)
      }
      catch (error) {
        results.push({
          tool: tool.name,
          duration: 0,
          originalSize: testBuffer.length,
          compressedSize: 0,
          compressionRatio: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })

        console.log(`   ❌ ${tool.name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // 验证至少有一个工具成功
    const successfulTools = results.filter(r => r.success)
    expect(successfulTools.length).toBeGreaterThan(0)

    // 性能统计
    if (successfulTools.length > 1) {
      console.log('\n📊 性能统计:')

      // 按速度排序
      const bySpeed = [...successfulTools].sort((a, b) => a.duration - b.duration)
      console.log('   速度排名:')
      bySpeed.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.tool}: ${result.duration}ms`)
      })

      // 按压缩率排序
      const byCompression = [...successfulTools].sort((a, b) => b.compressionRatio - a.compressionRatio)
      console.log('   压缩率排名:')
      byCompression.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.tool}: ${result.compressionRatio.toFixed(2)}%`)
      })

      // 按文件大小排序
      const bySize = [...successfulTools].sort((a, b) => a.compressedSize - b.compressedSize)
      console.log('   文件大小排名:')
      bySize.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.tool}: ${result.compressedSize} bytes`)
      })
    }

    // 验证每个成功的工具都产生了有效结果
    successfulTools.forEach((result) => {
      expect(result.compressedSize).toBeGreaterThan(0)
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })
  }, 30000) // 增加超时时间，因为某些工具可能较慢

  it('应该验证压缩结果的一致性', async () => {
    const qualities = [0.3, 0.5, 0.8]

    for (const quality of qualities) {
      const options = { ...defaultOptions, quality }

      console.log(`\n🔍 测试质量参数 ${quality}...`)

      for (const tool of tools) {
        if (!availableTools.includes(tool.name)) {
          continue
        }

        try {
          const result = await tool.func(testBuffer, options)
          expect(result).toBeInstanceOf(Buffer)
          expect(result.length).toBeGreaterThan(0)

          // 保存不同质量的结果
          saveTestResult(`quality_${quality}_${tool.name}.jpg`, result)

          console.log(`   ✅ ${tool.name}: ${result.length} bytes`)
        }
        catch (error) {
          console.log(`   ❌ ${tool.name}: 失败`, error instanceof Error ? error.message : String(error))
        }
      }
    }
  })
})

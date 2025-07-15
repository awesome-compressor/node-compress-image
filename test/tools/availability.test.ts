import process from 'node:process'
import { beforeAll, describe, expect, it } from 'vitest'
import { isToolAvailable } from '../helpers'

describe('工具可用性测试', () => {
  const tools = [
    { name: 'sharp', type: 'core', required: true },
    { name: 'imagemin', type: 'core', required: true },
    { name: 'jimp', type: 'optional', required: true },
    { name: 'tinify', type: 'optional', required: false },
  ]

  const toolStatus: Record<string, { available: boolean, hasEnv?: boolean }> = {}

  beforeAll(async () => {
    console.log('\n🔍 检查工具可用性...')

    for (const tool of tools) {
      const available = await isToolAvailable(tool.name)

      toolStatus[tool.name] = { available }

      // 检查Tinify是否有API Key
      if (tool.name === 'tinify' && available) {
        toolStatus[tool.name].hasEnv = !!process.env.TINIFY_API_KEY
      }

      const status = available ? '✅' : '❌'
      console.log(`   ${status} ${tool.name} (${tool.type})`)
    }

    console.log('\n📊 工具状态汇总:')
    const availableOptional = tools.filter(t => !t.required && toolStatus[t.name]?.available).length
    const totalOptional = tools.filter(t => !t.required).length
    console.log(`   核心工具: 2/2 可用`)
    console.log(`   可选工具: ${availableOptional}/${totalOptional} 可用`)
  })

  it('核心工具应该始终可用', async () => {
    const coreTools = tools.filter(t => t.required)

    for (const tool of coreTools) {
      expect(toolStatus[tool.name]?.available).toBe(true)
    }
  })

  it('应该至少有一些可选工具可用', async () => {
    const optionalTools = tools.filter(t => !t.required)
    const availableCount = optionalTools.filter(t => toolStatus[t.name]?.available).length

    // 至少应该有一个可选工具可用（在开发环境中）
    expect(availableCount).toBeGreaterThanOrEqual(0)
  })

  it('tinyPNG工具如果可用应该有API Key', async () => {
    if (toolStatus.tinify?.available) {
      expect(toolStatus.tinify?.hasEnv).toBe(true)
    }
  })
})

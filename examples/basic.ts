import process from 'node:process'
import { compress, compressDetailed, compressVariants, compressWithStats, getCapabilities } from '../src/index'

// 使用示例
async function example() {
  console.log('🚀 Node Compress Image 示例\n')

  // 创建一个简单的测试图像
  const testPNG = Buffer.from([
    0x89,
    0x50,
    0x4E,
    0x47,
    0x0D,
    0x0A,
    0x1A,
    0x0A,
    0x00,
    0x00,
    0x00,
    0x0D,
    0x49,
    0x48,
    0x44,
    0x52,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01,
    0x08,
    0x02,
    0x00,
    0x00,
    0x00,
    0x90,
    0x77,
    0x53,
    0xDE,
    0x00,
    0x00,
    0x00,
    0x0C,
    0x49,
    0x44,
    0x41,
    0x54,
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
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4E,
    0x44,
    0xAE,
    0x42,
    0x60,
    0x82,
  ])

  try {
    // 1. 基础压缩
    console.log('1. 基础压缩示例:')
    const compressed = await compress(testPNG, { quality: 0.8 })
    console.log(`原始大小: ${testPNG.length} bytes`)
    console.log(`压缩后大小: ${compressed.length} bytes`)
    console.log(`压缩率: ${(((testPNG.length - compressed.length) / testPNG.length) * 100).toFixed(1)}%`)
    console.log()

    // 2. 获取Base64格式
    console.log('2. Base64格式输出:')
    const base64Result = await compress(testPNG, { quality: 0.8, type: 'base64' })
    console.log(`Base64长度: ${base64Result.length} 字符`)
    console.log(`Base64前缀: ${base64Result.substring(0, 50)}...`)
    console.log()

    // 3. 详细统计信息
    console.log('3. 详细统计信息:')
    const stats = await compressWithStats(testPNG, { quality: 0.8 })
    console.log(`最佳工具: ${stats.bestTool}`)
    console.log(`原始大小: ${stats.originalSize} bytes`)
    console.log(`压缩大小: ${stats.compressedSize} bytes`)
    console.log(`压缩率: ${stats.compressionRatio.toFixed(1)}%`)
    console.log(`总耗时: ${stats.totalDuration}ms`)
    console.log('各工具表现:')
    stats.toolsUsed.forEach((tool) => {
      console.log(`  ${tool.tool}: ${tool.size} bytes (${tool.compressionRatio.toFixed(1)}%) - ${tool.duration}ms ${tool.success ? '✅' : '❌'}`)
    })
    console.log()

    // 4. 尺寸调整
    console.log('4. 尺寸调整示例:')
    const resized = await compress(testPNG, {
      quality: 0.8,
      maxWidth: 800,
      maxHeight: 600,
    })
    console.log(`调整尺寸后大小: ${resized.length} bytes`)
    console.log()

    // 5. 向后兼容的旧格式
    console.log('5. 旧版本兼容性:')
    const legacyResult = await compress(testPNG, 0.8, 'buffer')
    console.log(`旧格式结果大小: ${legacyResult.length} bytes`)
    console.log()

    // 6. 获取所有工具的结果
    console.log('6. 获取所有工具结果:')
    const allResults = await compress(testPNG, {
      quality: 0.8,
      returnAllResults: true,
    })
    console.log(`最佳工具: ${allResults.bestTool}`)
    console.log(`最佳结果大小: ${allResults.bestResult.length} bytes`)
    console.log(`总耗时: ${allResults.totalDuration}ms`)
    console.log(`工具数量: ${allResults.allResults.length}`)
    console.log()

    // 7. 能力探测
    console.log('7. 能力探测:')
    const capabilities = await getCapabilities()
    console.log(`输入格式: ${capabilities.inputFormats.join(', ')}`)
    console.log(`输出格式: ${capabilities.outputFormats.join(', ')}`)
    console.log(`可用工具: ${capabilities.tools.filter(tool => tool.installed).map(tool => tool.tool).join(', ')}`)
    console.log()

    // 8. 格式转换和可解释结果
    console.log('8. 格式转换和可解释结果:')
    const detailed = await compressDetailed(testPNG, {
      quality: 0.8,
      format: 'webp',
      strategy: 'balanced',
    })
    console.log(`输出格式: ${detailed.format}`)
    console.log(`选择原因: ${detailed.selectedReason}`)
    console.log(`输出大小: ${detailed.compressedSize} bytes`)
    console.log()

    // 9. 多格式变体
    console.log('9. 多格式变体:')
    const variants = await compressVariants(testPNG, {
      quality: 0.8,
      formats: ['webp', 'avif'],
    })
    variants.forEach((variant) => {
      console.log(`  ${variant.format}: ${variant.result.compressedSize} bytes`)
    })
    console.log()

    console.log('✅ 所有示例运行完成!')
  }
  catch (error) {
    console.error('❌ 运行示例时出错:', error)
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  example()
}

export { example }

import process from 'node:process'
import { compress, compressWithStats } from '../src/index'

// 使用示例
async function example() {
  console.log('🚀 Node Image Compression 三工具集成示例\n')

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
    0x73,
    0x75,
    0x01,
    0x18,
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

  console.log('📊 原始图像信息:')
  console.log(`   大小: ${testPNG.length} bytes`)
  console.log(`   类型: PNG\n`)

  // 示例1: 基础压缩（自动选择最优工具）
  console.log('🎯 示例1: 基础压缩（自动选择最优工具）')
  try {
    const basicResult = await compress(testPNG, {
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080,
    })

    console.log('✅ 基础压缩成功')
    console.log(`   压缩后大小: ${(basicResult as any).length} bytes`)
    console.log(`   类型: buffer`)
    console.log()
  }
  catch (error) {
    console.error('❌ 基础压缩失败:', error)
  }

  // 示例2: 多工具对比（返回所有结果）
  console.log('🔍 示例2: 多工具对比（返回所有结果）')
  try {
    const multiResult = await compress(testPNG, {
      quality: 0.8,
      returnAllResults: true,
    })

    console.log('✅ 多工具对比完成')
    console.log(`   最佳工具: ${multiResult.bestTool}`)
    console.log(`   总耗时: ${multiResult.totalDuration}ms`)
    console.log(`   测试工具数量: ${multiResult.allResults.length}`)
    console.log()
  }
  catch (error) {
    console.error('❌ 多工具对比失败:', error)
  }

  // 示例3: 使用统计信息
  console.log('📈 示例3: 使用统计信息')
  try {
    const statsResult = await compressWithStats(testPNG, {
      quality: 0.8,
      maxWidth: 1920,
    })

    console.log('✅ 统计信息:')
    console.log(`   最佳工具: ${statsResult.bestTool}`)
    console.log(`   原始大小: ${statsResult.originalSize} bytes`)
    console.log(`   压缩大小: ${statsResult.compressedSize} bytes`)
    console.log(`   压缩率: ${statsResult.compressionRatio.toFixed(2)}%`)
    console.log(`   总耗时: ${statsResult.totalDuration}ms`)
    console.log(`   测试工具数量: ${statsResult.toolsUsed.length}`)
    console.log()
  }
  catch (error) {
    console.error('❌ 统计信息获取失败:', error)
  }

  // 示例4: 不同输出格式
  console.log('📁 示例4: 不同输出格式')
  try {
    // Buffer格式（默认）
    const bufferResult = await compress(testPNG, {
      quality: 0.8,
      type: 'buffer',
    })
    console.log(`✅ Buffer: ${(bufferResult as any).length} bytes`)

    // Base64格式
    const base64Result = await compress(testPNG, {
      quality: 0.8,
      type: 'base64',
    })
    console.log(`✅ Base64: ${(base64Result as any).length} characters`)

    // Blob格式
    const blobResult = await compress(testPNG, {
      quality: 0.8,
      type: 'blob',
    })
    console.log(`✅ Blob: ${(blobResult as any).size} bytes`)
    console.log()
  }
  catch (error) {
    console.error('❌ 输出格式测试失败:', error)
  }

  // 示例5: 高级选项
  console.log('⚙️ 示例5: 高级选项')
  try {
    const advancedResult = await compress(testPNG, {
      quality: 0.6,
      targetWidth: 800,
      targetHeight: 600,
      preserveExif: true,
      mode: 'keepQuality',
    })

    console.log('✅ 高级选项压缩成功')
    console.log(`   压缩后大小: ${(advancedResult as any).length} bytes`)
    console.log(`   类型: buffer`)
    console.log()
  }
  catch (error) {
    console.error('❌ 高级选项压缩失败:', error)
  }

  console.log('🎉 示例完成!')
  console.log('\n📚 可用的压缩工具:')
  console.log('   ✅ Sharp (核心) - 高性能图像处理')
  console.log('   ✅ ImageMin (核心) - 专业无损压缩')
  console.log('   ✅ JIMP (可选) - 纯JavaScript实现')
  console.log('\n安装可选工具: npm install jimp')
}

// 运行示例
example().catch((error) => {
  console.error('示例运行失败:', error)
  process.exit(1)
})

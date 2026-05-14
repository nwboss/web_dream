#!/usr/bin/env node

/**
 * Seeddance 1.5 视频生成 API 测试脚本
 * 用法: node test-seeddance.js
 */

require('dotenv').config();

const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_ENDPOINT = process.env.ARK_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3';

if (!ARK_API_KEY) {
  console.error('❌ 错误: 未配置 ARK_API_KEY');
  console.error('请在 .env 文件中设置 ARK_API_KEY');
  process.exit(1);
}

console.log('🚀 开始测试 Seeddance 1.5 API...\n');
console.log(`📍 Endpoint: ${ARK_ENDPOINT}`);
console.log(`🔑 API Key: ${ARK_API_KEY.substring(0, 20)}...\n`);

// 测试提交任务
async function testSubmit() {
  console.log('📤 测试 1: 提交文生视频任务...');

  // 尝试不同的模型 ID - 根据你在控制台开通的模型调整
  const submitBody = {
    model: 'doubao-seedance-1-5-pro-251215',
    content: [
      {
        type: 'text',
        text: '一只可爱的小猫在阳光下玩耍'
      }
    ],
    ratio: '16:9',
    duration: 5,
    watermark: false
  };

  console.log('请求体:', JSON.stringify(submitBody, null, 2));

  try {
    const response = await fetch(`${ARK_ENDPOINT}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify(submitBody)
    });

    console.log(`\n响应状态: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log(`响应内容: ${responseText}\n`);

    if (!response.ok) {
      console.error(`❌ 提交失败: HTTP ${response.status}`);
      return null;
    }

    const data = JSON.parse(responseText);

    if (!data.id) {
      console.error('❌ 未返回任务 ID');
      console.error('响应数据:', data);
      return null;
    }

    console.log(`✅ 任务提交成功!`);
    console.log(`📋 Task ID: ${data.id}\n`);
    return data.id;

  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    return null;
  }
}

// 测试查询任务
async function testQuery(taskId) {
  console.log(`📥 测试 2: 查询任务状态...`);
  console.log(`📋 Task ID: ${taskId}\n`);

  let attempts = 0;
  const maxAttempts = 60;
  const pollInterval = 5000;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 轮询 ${attempts}/${maxAttempts}...`);

    try {
      const response = await fetch(
        `${ARK_ENDPOINT}/contents/generations/tasks/${taskId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ARK_API_KEY}`
          }
        }
      );

      console.log(`响应状态: ${response.status}`);

      if (!response.ok) {
        console.error(`❌ 查询失败: HTTP ${response.status}`);
        return false;
      }

      const data = await response.json();
      console.log(`API 响应:`, JSON.stringify(data, null, 2));

      const status = data.status;
      console.log(`状态: ${status}\n`);

      if (status === 'succeeded') {
        console.log('✅ 视频生成成功!');
        const videoUrl = data.content?.video_url;
        if (videoUrl) {
          console.log(`🎬 视频 URL: ${videoUrl}`);
        } else {
          console.log('⚠️  未返回视频 URL');
        }
        return true;
      }

      if (status === 'failed') {
        console.error(`❌ 任务失败: ${data.error?.message || '未知错误'}`);
        return false;
      }

      if (status === 'queued' || status === 'running') {
        console.log(`⏳ 任务处理中，${pollInterval / 1000} 秒后重试...\n`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      console.log(`❓ 未知状态: ${status}`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (error) {
      console.error('❌ 查询失败:', error.message);
      return false;
    }
  }

  console.error('❌ 轮询超时');
  return false;
}

// 主测试流程
async function main() {
  console.log('=' .repeat(60));
  console.log('Seeddance 1.5 API 测试');
  console.log('=' .repeat(60) + '\n');

  // 测试提交
  const taskId = await testSubmit();

  if (!taskId) {
    console.error('\n❌ 测试失败: 无法提交任务');
    process.exit(1);
  }

  // 等待一下再开始查询
  console.log('⏳ 等待 3 秒后开始查询...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 测试查询
  const success = await testQuery(taskId);

  console.log('\n' + '=' .repeat(60));
  if (success) {
    console.log('✅ 所有测试通过!');
  } else {
    console.log('❌ 测试未完全通过');
  }
  console.log('=' .repeat(60));

  process.exit(success ? 0 : 1);
}

// 运行测试
main().catch(error => {
  console.error('\n❌ 测试脚本出错:', error);
  process.exit(1);
});

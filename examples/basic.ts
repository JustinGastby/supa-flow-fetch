import { SupaFlow } from '../src';

async function main() {
  // 创建 SupaFlow 实例
  const flow = new SupaFlow('https://api.example.com/stream', {
    retryStrategy: {
      initialRetryDelay: 1000,
      maxRetryDelay: 5000,
      maxRetries: 3
    },
    heartbeat: {
      enabled: true,
      interval: 5000,
      timeout: 10000
    },
    dataHandler: (data) => {
      // 自定义数据处理示例
      if (typeof data === 'string') {
        return {
          message: data,
          processedAt: new Date().toISOString()
        };
      }
      return data;
    },
    debug: true
  });

  try {
    console.log('正在连接到流...');
    await flow.connect();
    
    // 设置一个定时器，10秒后检查缓冲区
    setTimeout(() => {
      const buffer = flow.getBuffer();
      console.log('缓冲区数据:', buffer);
      
      // 关闭连接
      flow.close();
      console.log('连接已关闭');
    }, 10000);

  } catch (error: any) {
    if (error.code === 'CONNECTION_ERROR') {
      console.error('连接错误:', error.message);
    } else if (error.code === 'MAX_RETRIES_EXCEEDED') {
      console.error('超过最大重试次数');
    } else {
      console.error('发生错误:', error);
    }
  }
}

main().catch(console.error); 
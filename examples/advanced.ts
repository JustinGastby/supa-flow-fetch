import { SupaFlow, ConnectionState } from '../src';

async function main() {
  // 创建数据转换器
  const transformers = [
    // 时间戳转换器
    (data: any) => ({
      ...data,
      timestamp: new Date(data.timestamp).toISOString()
    }),
    // 温度单位转换器（摄氏度转华氏度）
    (data: any) => ({
      ...data,
      temperature: data.temperature ? (data.temperature * 9/5 + 32).toFixed(1) + '°F' : undefined
    })
  ];

  // 创建 SupaFlow 实例
  const flow = new SupaFlow('https://api.example.com/stream', {
    // 事件过滤
    eventFilter: {
      include: ['temperature', 'humidity', 'batch'],
      exclude: ['heartbeat']
    },
    
    // 数据转换
    transformers,
    
    // 批处理配置
    batchConfig: {
      enabled: true,
      size: 5,
      interval: 3000
    },
    
    // 状态变化回调
    onStateChange: (state) => {
      console.log('连接状态变化:', state);
      
      // 可以在这里更新 UI 状态
      switch (state) {
        case ConnectionState.CONNECTING:
          console.log('正在连接...');
          break;
        case ConnectionState.CONNECTED:
          console.log('已连接');
          break;
        case ConnectionState.DISCONNECTED:
          console.log('已断开连接');
          break;
        case ConnectionState.RECONNECTING:
          console.log('正在重连...');
          break;
        case ConnectionState.ERROR:
          console.log('发生错误');
          break;
      }
    },
    
    // 开启调试模式
    debug: true
  });

  // 订阅温度事件
  flow.on('temperature', (data) => {
    console.log('收到温度数据:', data);
    // 数据已经被转换为华氏度
  });

  // 订阅湿度事件
  flow.on('humidity', (data) => {
    console.log('收到湿度数据:', data);
  });

  // 订阅批处理事件
  flow.on('batch', (data) => {
    console.log('收到批处理数据:', data);
    // 可以在这里进行批量数据处理，比如批量保存到数据库
  });

  try {
    // 连接到流
    await flow.connect();

    // 模拟运行一段时间后手动关闭连接
    setTimeout(() => {
      // 在关闭前处理剩余的批处理数据
      flow.flushBatchBuffer();
      
      // 获取并打印最终状态
      const finalState = flow.getState();
      const finalBuffer = flow.getBuffer();
      const finalBatchBuffer = flow.getBatchBuffer();
      
      console.log('最终状态:', finalState);
      console.log('缓冲区数据数量:', finalBuffer.length);
      console.log('批处理缓冲区数据数量:', finalBatchBuffer.length);
      
      // 关闭连接
      flow.close();
    }, 30000); // 30秒后关闭

  } catch (error: any) {
    console.error('发生错误:', error.code, error.message);
    if (error.details) {
      console.error('错误详情:', error.details);
    }
  }
}

main().catch(console.error); 
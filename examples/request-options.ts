import { SupaFlow } from '../src';

async function main() {
  const flow = new SupaFlow('https://api.example.com/stream', {
    // fetchOptions 包含了完整的 RequestInit 配置
    fetchOptions: {
      // HTTP 请求方法
      method: 'POST',
      
      // 请求头
      headers: {
        'Authorization': 'Bearer your-token-here',
        'X-Custom-Header': 'custom-value',
        'Content-Type': 'application/json'
      },
      
      // 请求体
      body: JSON.stringify({
        channel: 'temperature-sensors',
        location: 'building-a'
      }),
      
      // 凭证策略
      credentials: 'include',  // 包含 cookies
      
      // 缓存策略
      cache: 'no-cache',
      
      // 重定向策略
      redirect: 'follow',
      
      // 引用策略
      referrerPolicy: 'no-referrer',
      
      // 完整性校验
      integrity: 'sha256-hash',
      
      // 请求模式
      mode: 'cors',
      
      // 保持连接
      keepalive: true
    },
    
    // 其他 SupaFlow 配置
    debug: true
  });

  try {
    await flow.connect();
    
    // 订阅消息
    flow.on('message', (data) => {
      console.log('收到数据:', data);
    });

  } catch (error: any) {
    console.error('连接错误:', error);
  }
}

// 更多 RequestInit 使用场景示例

// 1. 使用自定义 Headers 对象
const withCustomHeaders = new SupaFlow('https://api.example.com/stream', {
  fetchOptions: {
    headers: new Headers({
      'Authorization': 'Bearer token',
      'Accept': 'text/event-stream'
    })
  }
});

// 2. 发送表单数据
const formData = new FormData();
formData.append('channel', 'sensors');
formData.append('location', 'room-1');

const withFormData = new SupaFlow('https://api.example.com/stream', {
  fetchOptions: {
    method: 'POST',
    body: formData
  }
});

// 3. 发送二进制数据
const withBinaryData = new SupaFlow('https://api.example.com/stream', {
  fetchOptions: {
    method: 'POST',
    body: new Blob(['binary data'], { type: 'application/octet-stream' }),
    headers: {
      'Content-Type': 'application/octet-stream'
    }
  }
});

// 4. 使用代理配置
const withProxy = new SupaFlow('https://api.example.com/stream', {
  fetchOptions: {
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Proxy-Authorization': 'Basic ' + btoa('username:password')
    }
  }
});

// 5. 自定义超时设置
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

const withTimeout = new SupaFlow('https://api.example.com/stream', {
  fetchOptions: {
    signal: controller.signal
  }
});

main().catch(console.error); 
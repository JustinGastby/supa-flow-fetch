# supa-flow-fetch

一个功能强大的流式数据获取工具，提供了完整的 SSE (Server-Sent Events) 支持，包括事件处理、数据转换、批处理等高级功能。

## 特点

- 🚀 完整的 SSE 协议支持
- 💪 强大的错误处理和重试机制
- 🔄 智能的自动重连
- ❤️ 可靠的心跳检测
- 📦 灵活的数据缓冲区管理
- 🛠️ 强大的数据转换和处理
- 🎯 事件过滤和订阅
- 📊 批量数据处理
- 🔍 完整的状态管理
- 🐛 详细的调试支持

## 安装

```bash
npm install supa-flow-fetch
```

## 基本用法

```typescript
import { SupaFlow } from 'supa-flow-fetch';

// 创建实例
const flow = new SupaFlow('https://api.example.com/stream', {
  retryStrategy: {
    initialRetryDelay: 1000,
    maxRetryDelay: 30000,
    maxRetries: 10
  },
  autoReconnect: true,
  heartbeat: {
    enabled: true,
    interval: 30000,
    timeout: 60000
  },
  bufferSize: 1000,
  debug: true
});


// 监听所有消息，默认为message,后端设置event实现订阅特定事件
flow.on('message', (data) => {
    console.log(data);
});


// 连接到流
try {
  await flow.connect();
} catch (error) {
  if (error.code === 'CONNECTION_ERROR') {
    console.error('连接失败:', error.message);
  }
}

// 获取缓冲区数据
const buffer = flow.getBuffer();

// 关闭连接
flow.close();
```

## 高级功能

### 事件订阅

```typescript
// 订阅特定事件
flow.on('temperature', (data) => {
  console.log('收到温度数据:', data);
});

// 取消订阅
const handler = (data) => console.log(data);
flow.on('humidity', handler);
flow.off('humidity', handler);
```

### 事件过滤

```typescript
const flow = new SupaFlow('https://api.example.com/stream', {
  eventFilter: {
    // 只处理这些事件
    include: ['temperature', 'humidity'],
    // 忽略这些事件
    exclude: ['heartbeat']
  }
});
```

### 数据转换

```typescript
const flow = new SupaFlow('https://api.example.com/stream', {
  transformers: [
    // 转换时间戳
    (data) => ({
      ...data,
      timestamp: new Date(data.timestamp).toISOString()
    }),
    // 转换温度单位
    (data) => ({
      ...data,
      temperature: data.temperature ? (data.temperature * 9/5 + 32) + '°F' : undefined
    })
  ]
});
```

### 批处理

```typescript
const flow = new SupaFlow('https://api.example.com/stream', {
  batchConfig: {
    enabled: true,
    size: 10,         // 每批数据量
    interval: 5000    // 处理间隔（毫秒）
  }
});

// 处理批量数据
flow.on('batch', (batchData) => {
  console.log('收到批量数据:', batchData);
});

// 手动处理剩余的批处理数据
flow.flushBatchBuffer();
```

### 状态管理

```typescript
import { SupaFlow, ConnectionState } from 'supa-flow-fetch';

const flow = new SupaFlow('https://api.example.com/stream', {
  onStateChange: (state) => {
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
  }
});

// 获取当前状态
const currentState = flow.getState();
```

## API 文档

### SupaFlow 类

#### 构造函数

```typescript
constructor(url: string, options?: SupaFlowOptions)
```

#### 选项

```typescript
interface SupaFlowOptions {
  // 重试策略
  retryStrategy?: {
    initialRetryDelay?: number; // 初始重试延迟（毫秒）
    maxRetryDelay?: number;     // 最大重试延迟（毫秒）
    maxRetries?: number;        // 最大重试次数
  };
  
  // 事件过滤器
  eventFilter?: {
    include?: string[];        // 包含的事件
    exclude?: string[];        // 排除的事件
  };
  
  // 数据转换器
  transformers?: Array<(data: any) => any>;
  
  // 状态变化回调
  onStateChange?: (state: ConnectionState) => void;
  
  // 批处理配置
  batchConfig?: {
    enabled: boolean;          // 是否启用批处理
    size?: number;            // 批处理大小
    interval?: number;        // 处理间隔（毫秒）
  };
  
  // 自动重连
  autoReconnect?: boolean;
  
  // 心跳检测
  heartbeat?: {
    enabled: boolean;         // 是否启用心跳
    interval?: number;        // 心跳间隔（毫秒）
    timeout?: number;         // 超时时间（毫秒）
  };
  
  // 缓冲区大小
  bufferSize?: number;
  
  // 调试模式
  debug?: boolean;
  
  // HTTP 请求配置
  fetchOptions?: RequestInit;
}
```

#### 方法

- `connect()`: 连接到流
- `close()`: 关闭连接
- `on(event: string, handler: (data: any) => void)`: 订阅事件
- `off(event: string, handler: (data: any) => void)`: 取消订阅
- `getState()`: 获取当前连接状态
- `getBuffer()`: 获取数据缓冲区
- `getBatchBuffer()`: 获取批处理缓冲区
- `flushBatchBuffer()`: 手动处理批处理缓冲区
- `clearBuffer()`: 清空数据缓冲区

### 连接状态

```typescript
enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}
```

### 错误类型

```typescript
class SupaFlowError extends Error {
  code: string;       // 错误代码
  details?: any;      // 错误详情
}
```

错误代码:
- `CONNECTION_ERROR`: 连接错误
- `MAX_RETRIES_EXCEEDED`: 超过最大重试次数
- `UNKNOWN_ERROR`: 未知错误

## 最佳实践

1. 始终处理错误:
```typescript
try {
  await flow.connect();
} catch (error) {
  if (error.code === 'CONNECTION_ERROR') {
    // 处理连接错误
  } else if (error.code === 'MAX_RETRIES_EXCEEDED') {
    // 处理重试失败
  }
}
```

2. 使用数据转换器保持代码整洁:
```typescript
const flow = new SupaFlow(url, {
  transformers: [
    // 数据清理
    data => ({...data, timestamp: new Date(data.timestamp)}),
    // 数据格式化
    data => ({...data, formattedValue: `${data.value}${data.unit}`})
  ]
});
```

3. 合理使用批处理:
```typescript
// 对于高频数据，使用批处理提高性能
const flow = new SupaFlow(url, {
  batchConfig: {
    enabled: true,
    size: 100,        // 根据数据量调整
    interval: 1000    // 根据实时性要求调整
  }
});
```

4. 监控连接状态:
```typescript
flow.on('state', (state) => {
  if (state === ConnectionState.ERROR) {
    // 记录错误日志
  } else if (state === ConnectionState.DISCONNECTED) {
    // 通知用户连接断开
  }
});
```
## HTTP 请求配置

SupaFlow 支持通过 `fetchOptions` 配置项来自定义 HTTP 请求的所有参数。这些参数遵循标准的 `RequestInit` 接口：

```typescript
const flow = new SupaFlow('https://api.example.com/stream', {
  fetchOptions: {
    // HTTP 方法
    method: 'POST',
    
    // 请求头
    headers: {
      'Authorization': 'Bearer your-token',
      'Content-Type': 'application/json'
    },
    
    // 请求体
    body: JSON.stringify({ channel: 'sensors' }),
    
    // 凭证处理
    credentials: 'include',  // 'omit' | 'same-origin' | 'include'
    
    // 缓存策略
    cache: 'no-cache',      // 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache' | 'only-if-cached'
    
    // 请求模式
    mode: 'cors',           // 'cors' | 'no-cors' | 'same-origin'
    
    // 重定向处理
    redirect: 'follow',     // 'follow' | 'error' | 'manual'
    
    // 引用策略
    referrerPolicy: 'no-referrer'
  }
});
```

### 常见使用场景

1. 发送认证信息：
```typescript
const flow = new SupaFlow(url, {
  fetchOptions: {
    headers: {
      'Authorization': 'Bearer your-token',
      'X-API-Key': 'your-api-key'
    }
  }
});
```

2. 发送表单数据：
```typescript
const formData = new FormData();
formData.append('channel', 'sensors');

const flow = new SupaFlow(url, {
  fetchOptions: {
    method: 'POST',
    body: formData
  }
});
```

3. 设置请求超时：
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const flow = new SupaFlow(url, {
  fetchOptions: {
    signal: controller.signal
  }
});
```

4. 处理 CORS：
```typescript
const flow = new SupaFlow(url, {
  fetchOptions: {
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  }
});
```

5. 自定义缓存策略：
```typescript
const flow = new SupaFlow(url, {
  fetchOptions: {
    cache: 'no-cache',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  }
});
```

### RequestInit 完整配置项

| 配置项 | 类型 | 说明 |
|--------|------|------|
| method | string | HTTP 请求方法 (GET, POST, etc.) |
| headers | Headers \| Record<string, string> | 请求头 |
| body | BodyInit | 请求体 |
| mode | RequestMode | 请求模式 |
| credentials | RequestCredentials | 凭证策略 |
| cache | RequestCache | 缓存策略 |
| redirect | RequestRedirect | 重定向策略 |
| referrer | string | 请求来源 |
| referrerPolicy | ReferrerPolicy | 引用策略 |
| integrity | string | 完整性校验 |
| keepalive | boolean | 保持连接 |
| signal | AbortSignal | 中止信号 |
| window | null | 请求上下文 | 


## 示例

完整的示例代码可以在 [examples](./examples) 目录中找到：
- [basic.ts](./examples/basic.ts): 基本用法示例
- [advanced.ts](./examples/advanced.ts): 高级功能示例

## 许可证

MIT 

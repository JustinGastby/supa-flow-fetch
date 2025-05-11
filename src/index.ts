// 定义事件消息接口
export interface EventMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export interface SupaFlowOptions {
  // 自定义重试策略
  retryStrategy?: {
    initialRetryDelay?: number;
    maxRetryDelay?: number;
    maxRetries?: number;
  };
  // 自定义数据处理器
  dataHandler?: (data: any) => any;
  // 自动重连配置
  autoReconnect?: boolean;
  // 心跳检测配置
  heartbeat?: {
    enabled: boolean;
    interval?: number;
    timeout?: number;
  };
  // 数据缓冲区大小
  bufferSize?: number;
  // 调试模式
  debug?: boolean;
  // HTTP 请求配置
  fetchOptions?: RequestInit;
  // 事件过滤器
  eventFilter?: {
    include?: string[];
    exclude?: string[];
  };
  // 数据转换器
  transformers?: Array<(data: any) => any>;
  // 状态回调
  onStateChange?: (state: ConnectionState) => void;
  // 批处理配置
  batchConfig?: {
    enabled: boolean;
    size?: number;
    interval?: number;
  };
}

export interface SupaFlowResponse<T> {
  data: T;
  metadata: {
    timestamp: number;
    eventId?: string;
    retryCount: number;
  };
}

export class SupaFlowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'SupaFlowError';
  }
}

// 连接状态枚举
export enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

// 事件处理器类型
type EventHandler = (data: any) => void;

export class SupaFlow {
  private retryCount = 0;
  private buffer: any[] = [];
  private controller: AbortController | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastMessageTime: number = Date.now();
  private lastEventId: string | null = null;
  private textDecoder: TextDecoder;
  private messageBuffer: string = '';
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private batchBuffer: any[] = [];
  private batchInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private url: string,
    private options: SupaFlowOptions = {}
  ) {
    // 设置默认选项
    this.options = {
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
      debug: false,
      fetchOptions: {},
      ...options
    };

    this.textDecoder = new TextDecoder();
    
    // 初始化批处理
    if (this.options.batchConfig?.enabled) {
      this.initBatchProcessing();
    }
  }

  private log(...args: any[]) {
    if (this.options.debug) {
      console.log('[SupaFlow]', ...args);
    }
  }

  private handleHeartbeat() {
    if (!this.options.heartbeat?.enabled) return;

    const interval = this.options.heartbeat.interval || 30000;
    const timeout = this.options.heartbeat.timeout || 60000;

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      if (now - this.lastMessageTime > timeout) {
        this.log('Heartbeat timeout, reconnecting...');
        this.reconnect();
      }
    }, interval);
  }

  private clearHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async reconnect() {
    this.log('Attempting to reconnect...');
    this.close();
    await this.connect();
  }

  private calculateRetryDelay() {
    const { initialRetryDelay = 1000, maxRetryDelay = 30000 } = this.options.retryStrategy || {};
    return Math.min(initialRetryDelay * Math.pow(2, this.retryCount), maxRetryDelay);
  }

  private parseEventStream(chunk: string): EventMessage[] {
    this.messageBuffer += chunk;
    const messages: EventMessage[] = [];
    const lines = this.messageBuffer.split(/\r?\n/);
    
    // 保留最后一行，因为它可能是不完整的
    this.messageBuffer = lines.pop() || '';

    let message: Partial<EventMessage> = {};

    for (const line of lines) {
      if (line === '') {
        // 空行表示消息结束
        if (Object.keys(message).length > 0) {
          messages.push(message as EventMessage);
          message = {};
        }
        continue;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const field = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      switch (field) {
        case 'id':
          message.id = value;
          this.lastEventId = value;
          break;
        case 'event':
          message.event = value;
          break;
        case 'data':
          message.data = message.data ? message.data + '\n' + value : value;
          break;
        case 'retry':
          const retry = parseInt(value, 10);
          if (!isNaN(retry)) message.retry = retry;
          break;
      }
    }

    return messages;
  }

  private setState(state: ConnectionState) {
    this.connectionState = state;
    this.options.onStateChange?.(state);
  }

  private initBatchProcessing() {
    const { interval = 1000 } = this.options.batchConfig || {};
    
    this.batchInterval = setInterval(() => {
      if (this.batchBuffer.length > 0) {
        this.processBatch();
      }
    }, interval);
  }

  private processBatch() {
    const { size = 10 } = this.options.batchConfig || {};
    
    while (this.batchBuffer.length >= size) {
      const batch = this.batchBuffer.splice(0, size);
      this.emit('batch', batch);
    }
  }

  private shouldProcessEvent(eventName: string): boolean {
    const { include, exclude } = this.options.eventFilter || {};
    
    if (include?.length) {
      return include.includes(eventName);
    }
    
    if (exclude?.length) {
      return !exclude.includes(eventName);
    }
    
    return true;
  }

  private transformData<T>(data: T): T {
    if (!this.options.transformers?.length) {
      return data;
    }

    return this.options.transformers.reduce((result, transformer) => {
      try {
        return transformer(result);
      } catch (error) {
        this.log('Transformer error:', error);
        return result;
      }
    }, data);
  }

  // 订阅事件
  public on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  // 取消订阅事件
  public off(event: string, handler: EventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  // 触发事件
  private emit(event: string, data: any): void {
    if (!this.shouldProcessEvent(event)) {
      return;
    }

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const transformedData = this.transformData(data);
      handlers.forEach(handler => {
        try {
          handler(transformedData);
        } catch (error) {
          this.log('Event handler error:', error);
        }
      });
    }
  }

  public async connect() {
    this.setState(ConnectionState.CONNECTING);
    this.controller = new AbortController();

    try {
      const headers = new Headers({
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...this.options.fetchOptions?.headers
      });

      if (this.lastEventId) {
        headers.set('Last-Event-ID', this.lastEventId);
      }

      const response = await fetch(this.url, {
        ...this.options.fetchOptions,
        headers,
        signal: this.controller.signal
      });

      if (!response.ok) {
        throw new SupaFlowError(
          `Failed to connect: ${response.status} ${response.statusText}`,
          'CONNECTION_ERROR',
          { status: response.status }
        );
      }

      if (!response.body) {
        throw new SupaFlowError(
          'Response body is null',
          'INVALID_RESPONSE'
        );
      }

      this.log('Connection established');
      this.retryCount = 0;
      this.handleHeartbeat();

      const reader = response.body.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          this.log('Stream complete');
          break;
        }

        if (value) {
          const chunk = this.textDecoder.decode(value, { stream: true });
          const messages = this.parseEventStream(chunk);

          for (const message of messages) {
            this.lastMessageTime = Date.now();
            
            let parsedData;
            try {
              parsedData = JSON.parse(message.data);
            } catch (e) {
              parsedData = message.data;
            }

            // 应用数据处理器
            if (this.options.dataHandler) {
              parsedData = this.options.dataHandler(parsedData);
            }

            // 处理批处理
            if (this.options.batchConfig?.enabled) {
              this.batchBuffer.push(parsedData);
              if (this.batchBuffer.length >= (this.options.batchConfig.size || 10)) {
                this.processBatch();
              }
            }

            // 触发事件
            this.emit(message.event || 'message', parsedData);

            // 管理缓冲区
            this.buffer.push({
              data: parsedData,
              metadata: {
                timestamp: Date.now(),
                eventId: message.id,
                retryCount: this.retryCount
              }
            });

            if (this.buffer.length > (this.options.bufferSize || 1000)) {
              this.buffer.shift();
            }

            this.log('Received message:', parsedData);
          }
        }
      }

      if (this.options.autoReconnect) {
        const delay = this.calculateRetryDelay();
        this.log(`Connection closed, reconnecting in ${delay}ms...`);
        setTimeout(() => this.reconnect(), delay);
      }

      this.setState(ConnectionState.CONNECTED);

    } catch (error) {
      this.setState(ConnectionState.ERROR);
      this.log('Error occurred:', error);
      
      if (error instanceof SupaFlowError) {
        throw error;
      }

      const { maxRetries = 10 } = this.options.retryStrategy || {};
      if (this.retryCount >= maxRetries) {
        throw new SupaFlowError(
          'Max retry attempts reached',
          'MAX_RETRIES_EXCEEDED',
          { retryCount: this.retryCount }
        );
      }

      this.retryCount++;
      
      if (this.options.autoReconnect) {
        const delay = this.calculateRetryDelay();
        this.log(`Error occurred, reconnecting in ${delay}ms...`);
        setTimeout(() => this.reconnect(), delay);
      } else {
        throw new SupaFlowError(
          'Connection failed',
          'UNKNOWN_ERROR',
          { originalError: error }
        );
      }
    }
  }

  public close() {
    this.setState(ConnectionState.DISCONNECTED);
    this.log('Closing connection...');
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    this.clearHeartbeat();
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }

  public getBuffer(): SupaFlowResponse<any>[] {
    return [...this.buffer];
  }

  public clearBuffer() {
    this.buffer = [];
  }

  // 获取当前连接状态
  public getState(): ConnectionState {
    return this.connectionState;
  }

  // 获取当前批处理缓冲区
  public getBatchBuffer(): any[] {
    return [...this.batchBuffer];
  }

  // 手动处理当前批处理缓冲区
  public flushBatchBuffer(): void {
    if (this.batchBuffer.length > 0) {
      const batch = [...this.batchBuffer];
      this.batchBuffer = [];
      this.emit('batch', batch);
    }
  }
} 
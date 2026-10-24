const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

type EventHandler = (event: { type: string; data: any; timestamp: string }) => void;

export class LiveEventSubscriber {
  private eventSource: EventSource | null = null;
  private listeners: EventHandler[] = [];
  private pollingTimer: any = null;
  private isConnected: boolean = false;
  private onStatusChange?: (connected: boolean) => void;

  constructor(onStatusChange?: (connected: boolean) => void) {
    this.onStatusChange = onStatusChange;
  }

  public connect(fallbackPollFn?: () => void) {
    if (typeof window === 'undefined') return;

    try {
      const sseUrl = `${API_BASE}/api/admin/events`;
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.onStatusChange?.(true);
        if (this.pollingTimer) {
          clearInterval(this.pollingTimer);
          this.pollingTimer = null;
        }
      };

      this.eventSource.addEventListener('message', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          this.notify(parsed);
        } catch (err) {
          console.error('Failed to parse SSE payload', err);
        }
      });

      this.eventSource.onerror = (err) => {
        console.warn('SSE connection interrupted. Falling back to polling...', err);
        this.isConnected = false;
        this.onStatusChange?.(false);
        this.disconnectSSE();

        // Start fallback polling if not already active
        if (!this.pollingTimer && fallbackPollFn) {
          this.pollingTimer = setInterval(fallbackPollFn, 6000);
          fallbackPollFn();
        }

        // Try reconnecting SSE in 8 seconds
        setTimeout(() => this.connect(fallbackPollFn), 8000);
      };
    } catch (err) {
      console.error('SSE initialization error', err);
      if (!this.pollingTimer && fallbackPollFn) {
        this.pollingTimer = setInterval(fallbackPollFn, 6000);
      }
    }
  }

  public subscribe(handler: EventHandler) {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  private notify(event: any) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private disconnectSSE() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  public disconnect() {
    this.disconnectSSE();
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isConnected = false;
    this.onStatusChange?.(false);
  }
}

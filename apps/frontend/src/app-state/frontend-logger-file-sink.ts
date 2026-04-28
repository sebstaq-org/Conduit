import { postRecords, shouldRetryIngest } from "./frontend-logger-ingest";
import type {
  FrontendLogRecord,
  FrontendLogSink,
} from "./frontend-logger-types";

const MAX_BATCH_SIZE = 64;
const MAX_QUEUE_SIZE = 4096;
const FLUSH_INTERVAL_MS = 1000;
const RETRY_DELAY_MS = 2000;

class FileLogSink implements FrontendLogSink {
  private readonly queue: FrontendLogRecord[] = [];
  private readonly sinkUrl: string;
  private flushInFlight = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(sinkUrl: string) {
    this.sinkUrl = sinkUrl;
  }

  public write(record: FrontendLogRecord): void {
    this.enqueueRecord(record);
    this.scheduleFlush(FLUSH_INTERVAL_MS);
  }

  public flushImmediately(): void {
    this.scheduleFlush(0);
  }

  private enqueueRecord(record: FrontendLogRecord): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift();
    }
    this.queue.push(record);
  }

  private requeueRecords(records: FrontendLogRecord[]): void {
    while (records.length > 0 && this.queue.length < MAX_QUEUE_SIZE) {
      const record = records.pop();
      if (record !== undefined) {
        this.queue.unshift(record);
      }
    }
  }

  private scheduleFlush(delayMs: number): void {
    if (this.flushTimer !== null) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushQueue();
    }, delayMs);
  }

  private scheduleDeferredFlush(shouldRetry: boolean): void {
    if (this.queue.length === 0 || this.flushTimer !== null) {
      return;
    }
    if (shouldRetry) {
      this.scheduleFlush(RETRY_DELAY_MS);
      return;
    }
    this.scheduleFlush(0);
  }

  private async tryFlushRecords(
    records: FrontendLogRecord[],
  ): Promise<boolean> {
    try {
      await postRecords(records, this.sinkUrl);
      return false;
    } catch (error) {
      const shouldRetry = shouldRetryIngest(error);
      if (shouldRetry) {
        this.requeueRecords(records);
      }
      return shouldRetry;
    }
  }

  private async flushQueue(): Promise<void> {
    if (this.flushInFlight || this.queue.length === 0) {
      return;
    }
    this.flushInFlight = true;
    const records = this.queue.splice(0, MAX_BATCH_SIZE);
    const shouldRetry = await this.tryFlushRecords(records);
    this.flushInFlight = false;
    this.scheduleDeferredFlush(shouldRetry);
  }
}

export { FileLogSink };

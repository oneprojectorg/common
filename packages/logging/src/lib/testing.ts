import type {
  LogRecord,
  Logger,
  LoggerProvider,
} from '@opentelemetry/api-logs';
import { logs } from '@opentelemetry/api-logs';

export interface RecordedOtelLogs {
  records: ReadonlyArray<LogRecord>;
  events: (name: string) => ReadonlyArray<LogRecord>;
  reset: () => void;
}

export const installRecordingLoggerProvider = (): RecordedOtelLogs => {
  const records: LogRecord[] = [];
  const recordingLogger: Logger = {
    emit(record) {
      records.push(record);
    },
  };
  const provider: LoggerProvider = { getLogger: () => recordingLogger };
  logs.setGlobalLoggerProvider(provider);

  return {
    records,
    events: (name) =>
      records.filter((record) => record.attributes?.['event.name'] === name),
    reset: () => {
      records.length = 0;
    },
  };
};

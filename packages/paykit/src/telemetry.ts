import { tryCatchAsync } from './tools';

export interface TelemetryEvent {
  /**
   * The name of the provider
   */
  provider: string;
  /**
   * The action of the event
   */
  action: string;
  /**
   * The amount of the event
   */
  amount?: number;
  /**
   * The currency of the event
   */
  currency?: string;
  /**
   * The status of the event
   */
  status?: string;
  /**
   * The metadata of the event
   */
  metadata?: Record<string, any>;
}

export class Telemetry {
  static log(
    event: TelemetryEvent,
    sdkVersion: string,
    isLiveMode: boolean,
  ) {
    tryCatchAsync(
      fetch('https://telemetry.usepaykit.dev/v1/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...event,
          timestamp: new Date().toISOString(),
          sdk_version: sdkVersion,
          is_live_mode: isLiveMode,
        }),
      }),
    ).catch(() => {});
  }
}

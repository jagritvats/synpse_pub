/** * Simple logger utility for the Express server
 * Provides consistent logging with service name
 */
export class Logger {
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Log an informational message
   */
  info(message: string, ...args: any[]) {
    console.log(`[${this.serviceName}] INFO: ${message}`, ...args);
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: any[]) {
    console.warn(`[${this.serviceName}] WARNING: ${message}`, ...args);
  }

  /**
   * Log an error message
   */
  error(message: string, ...args: any[]) {
    console.error(`[${this.serviceName}] ERROR: ${message}`, ...args);
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: any[]) {
    console.debug(`[${this.serviceName}] DEBUG: ${message}`, ...args);
  }
}

/**
 * Generate a unique ID using timestamp and random number
 */
export function generateUniqueId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique ID with prefix
 */
export function generateUniqueIdWithPrefix(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Counter-based unique ID generator for guaranteed uniqueness
 */
class IdGenerator {
  private counter = 0;
  
  generate(prefix?: string): string {
    this.counter += 1;
    const timestamp = Date.now();
    const id = `${timestamp}_${this.counter}`;
    return prefix ? `${prefix}_${id}` : id;
  }
  
  reset(): void {
    this.counter = 0;
  }
}

export const outputIdGenerator = new IdGenerator();
import { createContext, runInContext } from 'vm';
import { CommandResult } from '../types/shell.js';

export interface JSExecutionContext {
  $: any;
  fetch: typeof fetch;
  console: Console;
  Promise: PromiseConstructor;
  JSON: JSON;
  setTimeout: typeof setTimeout;
  setInterval: typeof setInterval;
  clearTimeout: typeof clearTimeout;
  clearInterval: typeof clearInterval;
}

export interface NPMPackageCache {
  [packageName: string]: any;
}

export class JSPipeEngine {
  private npmCache: NPMPackageCache = {};
  private context: JSExecutionContext;
  private vmContextCache: Map<string, any> = new Map();
  private lastContextKey: string = '';
  private maxCacheSize: number = 10;

  constructor() {
    this.context = this.createBaseContext();
  }

  /**
   * Create base execution context with common utilities
   */
  private createBaseContext(): JSExecutionContext {
    return {
      $: null, // Will be set per execution
      fetch: globalThis.fetch,
      console: console,
      Promise: Promise,
      JSON: JSON,
      setTimeout: setTimeout,
      setInterval: setInterval,
      clearTimeout: clearTimeout,
      clearInterval: clearInterval,
    };
  }

  /**
   * Enhanced context with async utilities and console capture
   */
  private createEnhancedContext(pipeInput?: string, consoleOutput?: string[]): any {
    const baseContext = this.createBaseContext();
    
    // Create custom console that captures output
    const customConsole = {
      log: (...args: any[]) => {
        const output = args.map(arg => 
          typeof arg === 'string' ? arg : JSON.stringify(arg)
        ).join(' ');
        if (consoleOutput) {
          consoleOutput.push(output);
        }
        // Also log to real console for debugging
        // console.log(...args);
      },
      error: (...args: any[]) => {
        const output = args.map(arg => 
          typeof arg === 'string' ? arg : JSON.stringify(arg)
        ).join(' ');
        if (consoleOutput) {
          consoleOutput.push(`ERROR: ${output}`);
        }
      },
      warn: (...args: any[]) => {
        const output = args.map(arg => 
          typeof arg === 'string' ? arg : JSON.stringify(arg)
        ).join(' ');
        if (consoleOutput) {
          consoleOutput.push(`WARN: ${output}`);
        }
      },
      info: (...args: any[]) => {
        const output = args.map(arg => 
          typeof arg === 'string' ? arg : JSON.stringify(arg)
        ).join(' ');
        if (consoleOutput) {
          consoleOutput.push(`INFO: ${output}`);
        }
      },
    };
    
    return {
      ...baseContext,
      $: this.parseInput(pipeInput),
      console: customConsole,
      
      // Async utilities
      async: {
        // Promise utilities
        all: Promise.all.bind(Promise),
        race: Promise.race.bind(Promise),
        allSettled: Promise.allSettled.bind(Promise),
        
        // Parallel execution helper
        parallel: async (tasks: (() => Promise<any>)[]) => {
          return Promise.all(tasks.map(task => task()));
        },
        
        // Sequential execution helper
        sequential: async (tasks: (() => Promise<any>)[]) => {
          const results = [];
          for (const task of tasks) {
            results.push(await task());
          }
          return results;
        },
        
        // Delay utility
        delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
        
        // Timeout wrapper
        timeout: <T>(promise: Promise<T>, ms: number): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
            )
          ]);
        }
      },
      
      // Array utilities for pipeline processing
      array: {
        chunk: <T>(arr: T[], size: number): T[][] => {
          const chunks = [];
          for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
          }
          return chunks;
        },
        
        flatten: <T>(arr: T[][]): T[] => arr.flat(),
        
        unique: <T>(arr: T[]): T[] => [...new Set(arr)],
        
        groupBy: <T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> => {
          return arr.reduce((groups, item) => {
            const key = keyFn(item);
            groups[key] = groups[key] || [];
            groups[key].push(item);
            return groups;
          }, {} as Record<string, T[]>);
        }
      },
      
      // HTTP utilities
      http: {
        get: async (url: string) => {
          const response = await fetch(url);
          return response.json();
        },
        
        post: async (url: string, data: any) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          return response.json();
        },
        
        // Parallel HTTP requests
        getAllParallel: async (urls: string[]) => {
          return Promise.all(urls.map(url => fetch(url).then(r => r.json())));
        }
      },
      
      // String utilities
      string: {
        lines: (str: string) => str.split('\n'),
        words: (str: string) => str.split(/\s+/),
        trim: (str: string) => str.trim(),
        capitalize: (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
      }
    };
  }

  /**
   * Get or create cached VM context
   */
  private getOrCreateVMContext(pipeInput?: string): any {
    // Create context key based on pipe input type/structure
    const inputType = this.getInputTypeKey(pipeInput);
    const contextKey = `context_${inputType}`;

    // Check if we have a cached context
    if (this.vmContextCache.has(contextKey)) {
      const cachedContext = this.vmContextCache.get(contextKey);
      // Update $ variable with new input
      cachedContext.$ = this.parseInput(pipeInput);
      return cachedContext;
    }

    // Create new context (without console capture for caching)
    const execContext = this.createEnhancedContext(pipeInput);
    const vmContext = createContext(execContext);

    // Cache the context (with LRU eviction)
    this.cacheVMContext(contextKey, vmContext);
    
    return vmContext;
  }

  /**
   * Cache VM context with LRU eviction
   */
  private cacheVMContext(key: string, context: any): void {
    // If cache is full, remove oldest entry
    if (this.vmContextCache.size >= this.maxCacheSize) {
      const firstKey = this.vmContextCache.keys().next().value;
      this.vmContextCache.delete(firstKey);
    }

    this.vmContextCache.set(key, context);
  }

  /**
   * Get input type key for context caching
   */
  private getInputTypeKey(input?: string): string {
    if (!input) return 'null';
    
    const trimmed = input.trim();
    
    // JSON object
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) return 'object';
    
    // JSON array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) return 'array';
    
    // Number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return 'number';
    
    // Multi-line string
    if (input.includes('\n')) return 'multiline';
    
    // Single line string
    return 'string';
  }

  /**
   * Execute JavaScript code with piped input
   */
  async executeJS(code: string, pipeInput?: string): Promise<CommandResult> {
    try {
      // Capture console output
      const consoleOutput: string[] = [];
      
      // Create enhanced context with console capture
      const execContext = this.createEnhancedContext(pipeInput, consoleOutput);

      // Create VM context (don't use cache for console capture)
      const vmContext = createContext(execContext);

      // Execute the code
      const result = runInContext(code, vmContext);

      // Handle async results
      const finalResult = await this.handleResult(result);

      // Combine console output and return value
      let output = '';
      
      // If console output exists, use that as primary output
      if (consoleOutput.length > 0) {
        output = consoleOutput.join('\n');
        
        // If there's also a return value that's not undefined, append it
        if (finalResult !== undefined && finalResult !== null) {
          const formattedResult = this.formatOutput(finalResult);
          if (formattedResult && formattedResult !== 'undefined') {
            output += '\n' + formattedResult;
          }
        }
      } else {
        // No console output, use return value
        output = this.formatOutput(finalResult);
      }

      return {
        stdout: output,
        stderr: '',
        exitCode: 0,
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: `JS Error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Execute NPM package command
   */
  async executeNPM(packageName: string, method: string, pipeInput?: string): Promise<CommandResult> {
    try {
      // Load package dynamically
      const pkg = await this.loadNPMPackage(packageName);
      
      if (!pkg) {
        return {
          stdout: '',
          stderr: `Package '${packageName}' not found or could not be imported`,
          exitCode: 1,
        };
      }

      let result;
      const input = this.parseInput(pipeInput);
      
      // Handle specific popular packages
      result = await this.handleSpecialPackages(pkg, packageName, method, input);
      
      if (result === null) {
        // Handle general case
        if (typeof pkg === 'function') {
          // Package is a function itself
          result = pkg(input);
        } else if (pkg[method] && typeof pkg[method] === 'function') {
          // Package has named method
          result = pkg[method](input);
        } else if (pkg.default && typeof pkg.default === 'function') {
          // Package has default export
          result = pkg.default(input);
        } else if (pkg.default && pkg.default[method] && typeof pkg.default[method] === 'function') {
          // Default export has named method
          result = pkg.default[method](input);
        } else {
          return {
            stdout: '',
            stderr: `Method '${method}' not found in package '${packageName}'`,
            exitCode: 1,
          };
        }
      }

      // Handle async results
      const finalResult = await this.handleResult(result);

      return {
        stdout: this.formatOutput(finalResult),
        stderr: '',
        exitCode: 0,
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: `NPM Error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Handle special cases for popular packages
   */
  private async handleSpecialPackages(pkg: any, packageName: string, method: string, input: any): Promise<any> {
    switch (packageName) {
      case 'chalk':
        // chalk.red('text'), chalk.blue('text'), etc.
        if (pkg[method] && typeof pkg[method] === 'function') {
          return pkg[method](String(input));
        }
        break;
        
      case 'figlet':
        // figlet(text)
        if (typeof pkg === 'function') {
          return new Promise((resolve, reject) => {
            pkg(String(input), (err: any, data: string) => {
              if (err) reject(err);
              else resolve(data);
            });
          });
        }
        break;
        
      case 'lodash':
      case '_':
        // _.map, _.filter, etc.
        if (pkg[method] && typeof pkg[method] === 'function') {
          // For lodash methods that expect (collection, iteratee)
          if (['map', 'filter', 'find'].includes(method)) {
            // Try to parse method as JavaScript function
            try {
              const iteratee = new Function('item', 'index', `return ${method === 'map' ? 'item' : 'true'}`);
              return pkg[method](input, iteratee);
            } catch (e) {
              return pkg[method](input);
            }
          }
          return pkg[method](input);
        }
        break;
    }
    
    return null; // Not a special case
  }

  /**
   * Dynamically load NPM package with caching
   */
  private async loadNPMPackage(packageName: string): Promise<any> {
    // Check cache first
    if (this.npmCache[packageName]) {
      return this.npmCache[packageName];
    }

    try {
      // Dynamic import with proper error handling
      const pkg = await import(packageName);
      this.npmCache[packageName] = pkg;
      return pkg;
    } catch (error) {
      // Try common package variations
      try {
        const pkg = await import(`node_modules/${packageName}`);
        this.npmCache[packageName] = pkg;
        return pkg;
      } catch (secondError) {
        console.error(`Failed to load package '${packageName}':`, error);
        return null;
      }
    }
  }

  /**
   * Parse piped input intelligently
   */
  private parseInput(input?: string): any {
    if (!input) return null;

    const trimmed = input.trim();
    
    // Try to parse as JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        // Fall through to string handling
      }
    }

    // Check if it's a number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // Return as string (original input with preserved whitespace)
    return input;
  }

  /**
   * Handle different result types including Promises
   */
  private async handleResult(result: any): Promise<any> {
    if (result instanceof Promise) {
      return await result;
    }
    return result;
  }

  /**
   * Format output for shell display
   */
  private formatOutput(result: any): string {
    if (result === null || result === undefined) {
      return '';
    }

    if (typeof result === 'string') {
      return result;
    }

    if (typeof result === 'object') {
      // Handle special object types
      if (result instanceof Response) {
        return `Response { status: ${result.status}, statusText: "${result.statusText}", url: "${result.url}" }`;
      }
      
      if (result instanceof Error) {
        return `Error: ${result.message}`;
      }
      
      if (result instanceof Promise) {
        return '[Promise]';
      }
      
      // Handle arrays
      if (Array.isArray(result)) {
        try {
          return JSON.stringify(result, null, 2);
        } catch (e) {
          return `[${result.join(', ')}]`;
        }
      }
      
      // Handle DOM elements or other non-serializable objects
      if (typeof result.toString === 'function' && result.toString !== Object.prototype.toString) {
        const str = result.toString();
        if (str !== '[object Object]' && !str.includes(',')) { // Avoid arrays with commas
          return str;
        }
      }
      
      // Try JSON serialization
      try {
        const jsonStr = JSON.stringify(result, null, 2);
        // If JSON.stringify returns empty object for non-empty object, use alternative
        if (jsonStr === '{}' && Object.keys(result).length > 0) {
          // Try to manually construct a representation
          return this.formatObjectManually(result);
        }
        return jsonStr;
      } catch (e) {
        return String(result);
      }
    }

    return String(result);
  }

  /**
   * Manually format objects that don't serialize well with JSON.stringify
   */
  private formatObjectManually(obj: any): string {
    try {
      const parts: string[] = [];
      
      // Get own properties
      const ownProps = Object.getOwnPropertyNames(obj);
      for (const prop of ownProps.slice(0, 10)) { // Limit to first 10 properties
        try {
          const value = obj[prop];
          const valueStr = typeof value === 'function' ? '[Function]' : 
                          typeof value === 'object' ? '[Object]' :
                          String(value);
          parts.push(`${prop}: ${valueStr}`);
        } catch (e) {
          parts.push(`${prop}: [Getter]`);
        }
      }
      
      // Get constructor name
      const constructorName = obj.constructor?.name || 'Object';
      
      if (parts.length === 0) {
        return `${constructorName} {}`;
      }
      
      return `${constructorName} {\n  ${parts.join(',\n  ')}\n}`;
    } catch (e) {
      return String(obj);
    }
  }

  /**
   * Clear NPM package cache (for memory management)
   */
  clearCache(): void {
    this.npmCache = {};
  }

  /**
   * Clear VM context cache
   */
  clearVMCache(): void {
    this.vmContextCache.clear();
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.clearCache();
    this.clearVMCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    npmPackages: number;
    vmContexts: number;
    maxVMContexts: number;
  } {
    return {
      npmPackages: Object.keys(this.npmCache).length,
      vmContexts: this.vmContextCache.size,
      maxVMContexts: this.maxCacheSize,
    };
  }

  /**
   * Get cached packages info
   */
  getCacheInfo(): { packageName: string; loaded: boolean }[] {
    return Object.keys(this.npmCache).map(packageName => ({
      packageName,
      loaded: !!this.npmCache[packageName],
    }));
  }

  /**
   * Optimize memory usage by clearing unused contexts
   */
  optimizeMemory(): void {
    // Keep only the most recent VM context
    if (this.vmContextCache.size > 1) {
      const entries = Array.from(this.vmContextCache.entries());
      this.vmContextCache.clear();
      
      // Keep only the last used context
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        this.vmContextCache.set(lastEntry[0], lastEntry[1]);
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}
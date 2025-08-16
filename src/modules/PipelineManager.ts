import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import { CommandResult, PipelineOptions, RedirectionType, ChainOperator, CommandChain } from '../types/shell.js';
import { JSPipeEngine } from './JSPipeEngine.js';

export interface PipelineCommand {
  command: string;
  args: string[];
  redirections: Redirection[];
}

export interface Redirection {
  type: RedirectionType;
  target: string;
  append?: boolean;  // for >> vs >
}

export interface Pipeline {
  commands: PipelineCommand[];
  background: boolean;
}

export class PipelineManager {
  private jsPipeEngine: JSPipeEngine;

  constructor() {
    this.jsPipeEngine = new JSPipeEngine();
  }

  /**
   * Check if command is a js pipe command
   */
  private isJSCommand(command: string): boolean {
    return command === 'js';
  }

  /**
   * Check if command uses npm: syntax
   */
  private isNPMCommand(command: string): boolean {
    return command.startsWith('npm:');
  }

  /**
   * Parse npm: command into package and method
   */
  private parseNPMCommand(command: string): { packageName: string; method: string } {
    const npmPart = command.slice(4); // Remove 'npm:' prefix
    const parts = npmPart.split('.');
    const packageName = parts[0];
    const method = parts[1] || 'default';
    return { packageName, method };
  }

  /**
   * Parse a command line that may contain chains (&&, ||, ;)
   * Returns either a single pipeline or executes the chain
   */
  async executeCommand(input: string, options: PipelineOptions): Promise<CommandResult> {
    // Check if this is a command chain
    if (this.isCommandChain(input)) {
      const chains = this.parseCommandChain(input);
      return this.executeCommandChain(chains, options);
    } else {
      // Single pipeline
      const pipeline = this.parsePipeline(input);
      return this.executePipeline(pipeline, options);
    }
  }

  /**
   * Check if input contains command chaining operators
   */
  private isCommandChain(input: string): boolean {
    return /&&|\|\||;/.test(input);
  }

  /**
   * Parse command chain into individual commands with their operators
   */
  private parseCommandChain(input: string): CommandChain[] {
    const chains: CommandChain[] = [];
    
    // Split by operators while preserving the operators
    const parts = input.split(/(\s*(?:&&|\|\||;)\s*)/);
    
    for (let i = 0; i < parts.length; i += 2) {
      const command = parts[i]?.trim();
      const operator = parts[i + 1]?.trim() as ChainOperator;
      
      if (command) {
        chains.push({
          pipeline: command,
          operator: operator || undefined,
        });
      }
    }
    
    return chains;
  }

  /**
   * Execute a chain of commands based on their operators
   */
  private async executeCommandChain(chains: CommandChain[], options: PipelineOptions): Promise<CommandResult> {
    let lastResult: CommandResult = { stdout: '', stderr: '', exitCode: 0 };
    let combinedStdout = '';
    let combinedStderr = '';

    for (let i = 0; i < chains.length; i++) {
      const chain = chains[i];
      const isLast = i === chains.length - 1;

      // Determine if we should execute this command based on the previous result
      let shouldExecute = true;

      if (i > 0) {
        const prevOperator = chains[i - 1].operator;
        
        if (prevOperator === '&&') {
          // Execute only if previous command succeeded
          shouldExecute = lastResult.exitCode === 0;
        } else if (prevOperator === '||') {
          // Execute only if previous command failed
          shouldExecute = lastResult.exitCode !== 0;
        }
        // For ';' or no operator, always execute
      }

      if (shouldExecute) {
        const pipeline = this.parsePipeline(chain.pipeline);
        lastResult = await this.executePipeline(pipeline, options);
        
        // Combine outputs
        if (lastResult.stdout) {
          combinedStdout += (combinedStdout ? '\n' : '') + lastResult.stdout;
        }
        if (lastResult.stderr) {
          combinedStderr += (combinedStderr ? '\n' : '') + lastResult.stderr;
        }
      }

      // For && and ||, if we skip execution, the result depends on why we skipped
      if (!shouldExecute) {
        if (chains[i - 1].operator === '&&') {
          // Previous command failed, so this chain fails
          lastResult = { stdout: '', stderr: '', exitCode: 1 };
        } else if (chains[i - 1].operator === '||') {
          // Previous command failed but || means we skip this, keeping the failed status
          // lastResult already contains the failure from the previous command
        }
      }
    }

    return {
      stdout: combinedStdout,
      stderr: combinedStderr,
      exitCode: lastResult.exitCode,
    };
  }

  /**
   * Parse a command line into a pipeline structure
   * Supports: pipes (|), redirections (>, >>, <), background (&)
   */
  parsePipeline(input: string): Pipeline {
    // Remove leading/trailing whitespace and normalize spaces
    const normalized = input.trim().replace(/\s+/g, ' ');
    
    // Check if command should run in background
    const background = normalized.endsWith(' &');
    const commandLine = background ? normalized.slice(0, -2).trim() : normalized;
    
    // Split by pipes first
    const pipeSegments = this.splitByPipes(commandLine);
    const commands: PipelineCommand[] = [];
    
    for (const segment of pipeSegments) {
      const parsedCommand = this.parseCommand(segment.trim());
      if (parsedCommand) {
        commands.push(parsedCommand);
      }
    }
    
    return { commands, background };
  }

  /**
   * Split command line by pipes while respecting quotes
   */
  private splitByPipes(input: string): string[] {
    const segments: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (char === '|' && !inQuotes) {
        if (current.trim()) {
          segments.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      segments.push(current.trim());
    }
    
    return segments;
  }

  /**
   * Parse a single command with redirections
   */
  private parseCommand(segment: string): PipelineCommand | null {
    const tokens = this.tokenize(segment);
    if (tokens.length === 0) return null;
    
    const command = tokens[0];
    const args: string[] = [];
    const redirections: Redirection[] = [];
    
    let i = 1;
    while (i < tokens.length) {
      const token = tokens[i];
      
      if (token === '>' || token === '>>' || token === '<') {
        if (i + 1 >= tokens.length) {
          throw new Error(`Missing target for redirection '${token}'`);
        }
        
        redirections.push({
          type: token as RedirectionType,
          target: tokens[i + 1],
          append: token === '>>',
        });
        i += 2;  // Skip the redirection target
      } else {
        args.push(token);
        i++;
      }
    }
    
    return { command, args, redirections };
  }

  /**
   * Simple tokenizer that respects quotes and redirections
   */
  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        // Don't include the quote character in the token - skip to next iteration
        continue;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        // Don't include the quote character in the token - skip to next iteration
        continue;
      } else if (!inQuotes) {
        // Handle redirection operators
        if (char === '>' && input[i + 1] === '>') {
          if (current) {
            tokens.push(current);
            current = '';
          }
          tokens.push('>>');
          i++; // Skip next character
          continue;
        } else if (char === '>' || char === '<') {
          if (current) {
            tokens.push(current);
            current = '';
          }
          tokens.push(char);
          continue;
        } else if (char === ' ') {
          if (current) {
            tokens.push(current);
            current = '';
          }
          continue;
        }
      }
      
      // Add character to current token (quotes are skipped above)
      current += char;
    }
    
    if (current) {
      tokens.push(current);
    }
    
    return tokens;
  }

  /**
   * Execute a pipeline of commands
   */
  async executePipeline(pipeline: Pipeline, options: PipelineOptions): Promise<CommandResult> {
    if (pipeline.commands.length === 0) {
      return { stdout: '', stderr: 'No commands in pipeline', exitCode: 1 };
    }
    
    if (pipeline.commands.length === 1) {
      // Single command - handle redirections
      return this.executeCommandWithRedirections(pipeline.commands[0], options);
    }
    
    // Multiple commands - create pipe chain
    return this.executePipeChain(pipeline.commands, options);
  }

  /**
   * Execute a single command with redirections
   */
  private async executeCommandWithRedirections(
    cmd: PipelineCommand, 
    options: PipelineOptions
  ): Promise<CommandResult> {
    const { command, args, redirections } = cmd;
    
    // Prepare stdio configuration for redirections
    const stdio: any[] = ['inherit', 'pipe', 'pipe'];
    
    for (const redir of redirections) {
      switch (redir.type) {
        case '>':
        case '>>':
          // Output redirection will be handled after spawn
          break;
        case '<':
          // Input redirection
          try {
            const inputFd = fs.openSync(redir.target, 'r');
            stdio[0] = inputFd;
          } catch (error) {
            return { 
              stdout: '', 
              stderr: `Cannot open '${redir.target}' for input: ${error instanceof Error ? error.message : 'Unknown error'}`, 
              exitCode: 1 
            };
          }
          break;
      }
    }
    
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: options.currentDirectory,
        env: options.env,
        stdio,
      });

      let stdout = '';
      let stderr = '';

      // Handle output redirections
      const outputRedirection = redirections.find(r => r.type === '>' || r.type === '>>');
      
      if (outputRedirection) {
        // Redirect stdout to file
        const writeStream = fs.createWriteStream(outputRedirection.target, { 
          flags: outputRedirection.append ? 'a' : 'w' 
        });
        
        if (child.stdout) {
          child.stdout.pipe(writeStream);
        }
      } else {
        // Capture stdout normally
        if (child.stdout) {
          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });
        }
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
        });
      });

      child.on('error', (error) => {
        resolve({
          stdout: '',
          stderr: `Failed to execute '${command}': ${error.message}`,
          exitCode: 1,
        });
      });
    });
  }

  /**
   * Execute a JS or NPM command with piped input
   */
  private async executeJSCommand(
    cmd: PipelineCommand,
    pipeInput?: string,
    options?: PipelineOptions
  ): Promise<CommandResult> {
    const { command, args } = cmd;

    if (this.isJSCommand(command)) {
      // js command: join args as JavaScript code
      const code = args.join(' ');
      return this.jsPipeEngine.executeJS(code, pipeInput);
    } else if (this.isNPMCommand(command)) {
      // npm: command
      const { packageName, method } = this.parseNPMCommand(command);
      const additionalArgs = args.length > 0 ? args.join(' ') : method;
      return this.jsPipeEngine.executeNPM(packageName, additionalArgs, pipeInput);
    }

    // Should not reach here
    return {
      stdout: '',
      stderr: `Unsupported JS/NPM command: ${command}`,
      exitCode: 1,
    };
  }

  /**
   * Check if pipeline contains any JS or NPM commands
   */
  private hasJSCommands(commands: PipelineCommand[]): boolean {
    return commands.some(cmd => 
      this.isJSCommand(cmd.command) || this.isNPMCommand(cmd.command)
    );
  }

  /**
   * Execute mixed pipeline with JS/NPM and regular commands
   */
  private async executeMixedPipeline(
    commands: PipelineCommand[],
    options: PipelineOptions
  ): Promise<CommandResult> {
    let currentInput = '';
    let finalResult: CommandResult = { stdout: '', stderr: '', exitCode: 0 };

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      
      if (this.isJSCommand(cmd.command) || this.isNPMCommand(cmd.command)) {
        // Execute JS/NPM command with current input
        finalResult = await this.executeJSCommand(cmd, currentInput, options);
        
        if (finalResult.exitCode !== 0) {
          return finalResult; // Early exit on error
        }
        
        currentInput = finalResult.stdout;
      } else {
        // Execute regular command
        if (i === 0) {
          // First command - no input
          finalResult = await this.executeCommandWithRedirections(cmd, options);
        } else {
          // Pipe current input to command
          finalResult = await this.executeCommandWithInput(cmd, currentInput, options);
        }
        
        if (finalResult.exitCode !== 0) {
          return finalResult; // Early exit on error
        }
        
        currentInput = finalResult.stdout;
      }
    }

    return finalResult;
  }

  /**
   * Execute regular command with string input
   */
  private async executeCommandWithInput(
    cmd: PipelineCommand,
    input: string,
    options: PipelineOptions
  ): Promise<CommandResult> {
    const { command, args, redirections } = cmd;
    
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: options.currentDirectory,
        env: options.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      // Write input to stdin
      if (child.stdin && input) {
        child.stdin.write(input);
        child.stdin.end();
      }

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
        });
      });

      child.on('error', (error) => {
        resolve({
          stdout: '',
          stderr: `Failed to execute '${command}': ${error.message}`,
          exitCode: 1,
        });
      });
    });
  }

  /**
   * Execute a chain of piped commands
   */
  private async executePipeChain(
    commands: PipelineCommand[], 
    options: PipelineOptions
  ): Promise<CommandResult> {
    // Check if pipeline contains JS/NPM commands
    if (this.hasJSCommands(commands)) {
      return this.executeMixedPipeline(commands, options);
    }

    // Original implementation for regular commands only
    const processes: ChildProcess[] = [];
    let finalStdout = '';
    let combinedStderr = '';

    return new Promise((resolve) => {
      try {
        // Spawn all processes
        for (let i = 0; i < commands.length; i++) {
          const cmd = commands[i];
          const isFirst = i === 0;
          const isLast = i === commands.length - 1;
          
          let stdio: any[];
          
          // Handle input redirection for first command
          if (isFirst) {
            const inputRedirection = cmd.redirections.find(r => r.type === '<');
            if (inputRedirection) {
              try {
                const inputFd = fs.openSync(inputRedirection.target, 'r');
                stdio = [inputFd, 'pipe', 'pipe'];
              } catch (error) {
                resolve({
                  stdout: '',
                  stderr: `Cannot open '${inputRedirection.target}' for input: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  exitCode: 1,
                });
                return;
              }
            } else {
              stdio = ['inherit', 'pipe', 'pipe'];
            }
          } else if (isLast) {
            // Last command: pipe stdin, handle output redirection or pipe stdout
            stdio = ['pipe', 'pipe', 'pipe'];
          } else {
            // Middle command: pipe both stdin and stdout
            stdio = ['pipe', 'pipe', 'pipe'];
          }
          
          const process = spawn(cmd.command, cmd.args, {
            cwd: options.currentDirectory,
            env: options.env,
            stdio,
          });
          
          processes.push(process);
          
          // Connect pipes between processes
          if (i > 0 && processes[i - 1].stdout && process.stdin) {
            processes[i - 1].stdout.pipe(process.stdin);
          }
          
          // Handle output redirection for last command
          if (isLast) {
            const outputRedirection = cmd.redirections.find(r => r.type === '>' || r.type === '>>');
            if (outputRedirection) {
              // Redirect stdout to file
              const writeStream = fs.createWriteStream(outputRedirection.target, { 
                flags: outputRedirection.append ? 'a' : 'w' 
              });
              
              if (process.stdout) {
                process.stdout.pipe(writeStream);
              }
            } else {
              // Capture stdout from the last process only
              if (process.stdout) {
                process.stdout.on('data', (data) => {
                  finalStdout += data.toString();
                });
              }
            }
          }
          
          // Capture stderr from all processes
          if (process.stderr) {
            process.stderr.on('data', (data) => {
              combinedStderr += data.toString();
            });
          }
        }
        
        // Wait for the last process to complete
        const lastProcess = processes[processes.length - 1];
        
        let completedProcesses = 0;
        let finalExitCode = 0;
        
        processes.forEach((proc, index) => {
          proc.on('close', (code) => {
            completedProcesses++;
            
            // The exit code of the pipeline is the exit code of the last command
            if (index === processes.length - 1) {
              finalExitCode = code || 0;
            }
            
            // When all processes are done
            if (completedProcesses === processes.length) {
              resolve({
                stdout: finalStdout.trim(),
                stderr: combinedStderr.trim(),
                exitCode: finalExitCode,
              });
            }
          });
          
          proc.on('error', (error) => {
            // Kill any remaining processes on error
            processes.forEach(p => {
              if (!p.killed) {
                p.kill();
              }
            });
            
            resolve({
              stdout: finalStdout.trim(),
              stderr: `Pipeline error: ${error.message}`,
              exitCode: 1,
            });
          });
        });
        
      } catch (error) {
        resolve({
          stdout: '',
          stderr: `Failed to create pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`,
          exitCode: 1,
        });
      }
    });
  }
}
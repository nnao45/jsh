import { execa } from 'execa';
import { CommandResult, CommandOptions, InteractiveCommandOptions } from '../types/shell.js';
import { spawn } from 'child_process';

export class CommandExecutor {
  // List of commands that require interactive TTY support
  private readonly interactiveCommands = new Set([
    'top', 'htop', 'tmux', 'screen', 'vim', 'vi', 'nano', 'emacs',
    'less', 'more', 'man', 'pager', 'watch', 'tail', 'ssh', 'ftp',
    'telnet', 'nc', 'netcat', 'mysql', 'psql', 'mongo', 'redis-cli',
    'python', 'node', 'irb', 'python3', 'ipython', 'gdb', 'lldb',
    'docker', 'sudo', 'su', 'passwd', 'crontab', 'visudo'
  ]);

  /**
   * Check if a command is likely to be interactive
   */
  private isInteractiveCommand(command: string): boolean {
    const [cmd] = command.trim().split(/\s+/);
    return this.interactiveCommands.has(cmd);
  }

  /**
   * Execute an interactive command with TTY support
   */
  async executeInteractive(command: string, options: InteractiveCommandOptions): Promise<CommandResult> {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.trim().split(/\s+/);
      
      if (!cmd) {
        resolve({ stdout: '', stderr: 'No command provided', exitCode: 1 });
        return;
      }

      // Suspend the UI before running the interactive command
      if (options.onSuspendUI) {
        options.onSuspendUI();
      }

      const child = spawn(cmd, args, {
        cwd: options.currentDirectory,
        env: options.env,
        stdio: 'inherit', // This gives the child process direct access to stdin/stdout/stderr
      });

      child.on('close', (code) => {
        // Restore the UI after the command exits
        if (options.onRestoreUI) {
          options.onRestoreUI();
        }
        
        if (options.onExit) {
          options.onExit();
        }

        resolve({
          stdout: '',
          stderr: '',
          exitCode: code || 0,
        });
      });

      child.on('error', (error) => {
        // Restore the UI on error too
        if (options.onRestoreUI) {
          options.onRestoreUI();
        }
        
        if (options.onExit) {
          options.onExit();
        }

        resolve({
          stdout: '',
          stderr: error.message,
          exitCode: 1,
        });
      });
    });
  }

  /**
   * Main execute method that automatically routes to appropriate execution method
   */
  async execute(command: string, options: CommandOptions | InteractiveCommandOptions): Promise<CommandResult> {
    // If this is an interactive command and we have the UI control callbacks,
    // use interactive execution
    if (this.isInteractiveCommand(command) && 'onSuspendUI' in options && options.onSuspendUI) {
      return this.executeInteractive(command, options as InteractiveCommandOptions);
    }
    
    // Otherwise use regular execution
    return this.executeRegular(command, options);
  }

  /**
   * Regular (non-interactive) command execution using execa
   */
  async executeRegular(command: string, options: CommandOptions): Promise<CommandResult> {
    try {
      const [cmd, ...args] = command.trim().split(/\s+/);
      
      if (!cmd) {
        return { stdout: '', stderr: 'No command provided', exitCode: 1 };
      }
      
      const result = await execa(cmd, args, {
        cwd: options.currentDirectory,
        env: options.env,
        timeout: 30000, // 30秒タイムアウト ⏱️
        stripFinalNewline: false,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? 0,
      };
    } catch (error: any) {
      // execaエラーを適切に処理 🔧
      if (error.exitCode !== undefined) {
        return {
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          exitCode: error.exitCode,
        };
      }

      // その他のエラー（コマンドが見つからない等） 🚫
      return {
        stdout: '',
        stderr: error.message || 'Unknown error occurred',
        exitCode: 1,
      };
    }
  }

  // プロセスをキルする機能 ☠️
  async killProcess(pid: number): Promise<void> {
    try {
      process.kill(pid, 'SIGTERM');
    } catch (error) {
      console.error('Failed to kill process:', error);
    }
  }
}
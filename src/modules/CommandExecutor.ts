import { execa } from 'execa';
import { CommandResult, CommandOptions } from '../types/shell.js';

export class CommandExecutor {
  async execute(command: string, options: CommandOptions): Promise<CommandResult> {
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
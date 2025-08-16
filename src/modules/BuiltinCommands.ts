import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { glob } from 'glob';
import { ShellState, CommandResult, ShellCommand } from '../types/shell.js';
import { ProcessManager } from './ProcessManager.js';
import { PtyManager } from './PtyManager.js';
import { JSPipeEngine } from './JSPipeEngine.js';
import { HistoryManager } from './HistoryManager.js';

export class BuiltinCommands {
  private commands: Map<string, ShellCommand> = new Map();
  private setState: React.Dispatch<React.SetStateAction<ShellState>>;
  private processManager: ProcessManager;
  private ptyManager: PtyManager;
  private jsPipeEngine: JSPipeEngine;
  private historyManager?: HistoryManager;

  constructor(setState: React.Dispatch<React.SetStateAction<ShellState>>, historyManager?: HistoryManager) {
    this.setState = setState;
    this.processManager = new ProcessManager();
    this.ptyManager = new PtyManager();
    this.jsPipeEngine = new JSPipeEngine();
    this.historyManager = historyManager;
    this.initializeCommands();
  }

  private initializeCommands(): void {
    // cd コマンド - ディレクトリ移動 📁
    this.commands.set('cd', {
      name: 'cd',
      description: 'ディレクトリを変更します',
      usage: 'cd [directory]',
      execute: async (args) => {
        const target = args.length > 0 ? args[0] : os.homedir();
        if (!target) {
          return { stdout: '', stderr: 'cd: invalid target', exitCode: 1 };
        }
        const newPath = path.resolve(target.startsWith('~') ? target.replace('~', os.homedir()) : target);
        
        try {
          const stats = await fs.stat(newPath);
          if (stats.isDirectory()) {
            // Node.jsのワーキングディレクトリを変更 🔄
            process.chdir(newPath);
            // シェル状態も更新 📝
            this.setState(prev => ({ ...prev, currentDirectory: newPath }));
            return { stdout: '', stderr: '', exitCode: 0 };
          } else {
            return { stdout: '', stderr: `cd: not a directory: ${target}`, exitCode: 1 };
          }
        } catch (error) {
          return { stdout: '', stderr: `cd: no such file or directory: ${target}`, exitCode: 1 };
        }
      }
    });

    // pwd コマンド - 現在のディレクトリ表示 🗺️
    this.commands.set('pwd', {
      name: 'pwd',
      description: '現在の作業ディレクトリを表示します',
      execute: async () => {
        return { stdout: process.cwd(), stderr: '', exitCode: 0 };
      }
    });

    // ls コマンド - ファイル一覧表示 📋
    this.commands.set('ls', {
      name: 'ls',
      description: 'ディレクトリの内容を表示します',
      usage: 'ls [options] [directory]',
      execute: async (args) => {
        const showHidden = args.includes('-a') || args.includes('-la');
        const longFormat = args.includes('-l') || args.includes('-la');
        const targetDir = args.find(arg => !arg.startsWith('-')) || process.cwd();

        try {
          const entries = await fs.readdir(targetDir, { withFileTypes: true });
          const filtered = showHidden ? entries : entries.filter(entry => !entry.name.startsWith('.'));

          if (longFormat) {
            const details = await Promise.all(
              filtered.map(async (entry) => {
                const fullPath = path.join(targetDir, entry.name);
                const stats = await fs.stat(fullPath);
                const type = entry.isDirectory() ? 'd' : '-';
                const permissions = this.getPermissions(stats.mode);
                const size = stats.size.toString().padStart(8);
                const modified = stats.mtime.toISOString().split('T')[0];
                const icon = entry.isDirectory() ? '📁' : '📄';
                
                return `${type}${permissions} ${size} ${modified} ${icon} ${entry.name}`;
              })
            );
            return { stdout: details.join('\n'), stderr: '', exitCode: 0 };
          } else {
            const names = filtered.map(entry => {
              const icon = entry.isDirectory() ? '📁' : '📄';
              return `${icon} ${entry.name}`;
            });
            return { stdout: names.join('  '), stderr: '', exitCode: 0 };
          }
        } catch (error) {
          return { stdout: '', stderr: `ls: ${error instanceof Error ? error.message : 'Unknown error'}`, exitCode: 1 };
        }
      }
    });

    // mkdir コマンド - ディレクトリ作成 🏗️
    this.commands.set('mkdir', {
      name: 'mkdir',
      description: 'ディレクトリを作成します',
      usage: 'mkdir [options] directory',
      execute: async (args) => {
        if (args.length === 0) {
          return { stdout: '', stderr: 'mkdir: missing operand', exitCode: 1 };
        }

        const recursive = args.includes('-p');
        const dirs = args.filter(arg => !arg.startsWith('-'));

        try {
          for (const dir of dirs) {
            await fs.mkdir(dir, { recursive });
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        } catch (error) {
          return { stdout: '', stderr: `mkdir: ${error instanceof Error ? error.message : 'Unknown error'}`, exitCode: 1 };
        }
      }
    });

    // history コマンド - コマンド履歴表示 📚
    this.commands.set('history', {
      name: 'history',
      description: 'コマンド履歴を表示・管理します',
      usage: 'history [clear]',
      execute: async (args) => {
        if (!this.historyManager) {
          return { stdout: '', stderr: 'HistoryManager is not available', exitCode: 1 };
        }

        // clear オプションをチェック
        if (args.length > 0 && args[0] === 'clear') {
          await this.historyManager.clearHistory();
          
          // 状態も更新
          this.setState(prev => ({
            ...prev,
            history: [],
            historyIndex: -1,
          }));
          
          return { stdout: '履歴をクリアしました', stderr: '', exitCode: 0 };
        }

        // 履歴表示
        const history = this.historyManager.getHistory();
        if (history.length === 0) {
          return { stdout: '履歴がありません', stderr: '', exitCode: 0 };
        }

        const historyList = history.map((cmd, index) => `${index + 1}  ${cmd}`).join('\n');
        const stats = this.historyManager.getStats();
        const output = `${historyList}\n\n履歴ファイル: ${stats.filePath}\n総コマンド数: ${stats.totalCommands}`;
        
        return { stdout: output, stderr: '', exitCode: 0 };
      }
    });

    // clear コマンド - 画面クリア 🧹
    this.commands.set('clear', {
      name: 'clear',
      description: '画面をクリアします',
      execute: async () => {
        this.setState(prev => ({ ...prev, output: [] }));
        return { stdout: '', stderr: '', exitCode: 0 };
      }
    });

    // exit コマンド - シェル終了 👋
    this.commands.set('exit', {
      name: 'exit',
      description: 'シェルを終了します',
      execute: async (args) => {
        const exitCode = args.length > 0 ? parseInt(args[0]) || 0 : 0;
        process.exit(exitCode);
      }
    });

    // help コマンド - ヘルプ表示 ❓
    this.commands.set('help', {
      name: 'help',
      description: '利用可能なコマンドを表示します',
      execute: async () => {
        const helpText = Array.from(this.commands.values())
          .map(cmd => `📖 ${cmd.name.padEnd(10)} - ${cmd.description}`)
          .join('\n');
        
        const header = '🐚 InkSh Built-in Commands ✨\n' + '='.repeat(40) + '\n';
        const footer = '\n💡 環境変数:\n' +
                      '  INKSH_ANIMATION=false     - アニメーション無効化\n' +
                      '  INKSH_ANIMATION_INTERVAL  - アニメーション間隔(ms)';
        return { stdout: header + helpText + footer, stderr: '', exitCode: 0 };
      }
    });

    // jobs コマンド - アクティブなジョブ一覧 💼
    this.commands.set('jobs', {
      name: 'jobs',
      description: 'アクティブなジョブを表示します',
      execute: async () => {
        const jobs = this.processManager.listJobs();
        if (jobs.length === 0) {
          return { stdout: 'No active jobs', stderr: '', exitCode: 0 };
        }

        const jobsList = jobs.map(job => {
          const status = job.status === 'running' ? '✅ Running' : 
                        job.status === 'stopped' ? '⏸️ Stopped' : '✅ Done';
          const duration = job.endTime ? 
            `(${Math.round((job.endTime.getTime() - job.startTime.getTime()) / 1000)}s)` :
            `(${Math.round((Date.now() - job.startTime.getTime()) / 1000)}s)`;
          
          return `[${job.id}] ${status} ${duration} ${job.command}`;
        }).join('\n');

        return { stdout: jobsList, stderr: '', exitCode: 0 };
      }
    });

    // kill コマンド - ジョブ終了 ☠️
    this.commands.set('kill', {
      name: 'kill',
      description: 'ジョブまたはプロセスを終了します',
      usage: 'kill [-SIGNAL] job_id',
      execute: async (args) => {
        if (args.length === 0) {
          return { stdout: '', stderr: 'kill: usage: kill [-SIGNAL] job_id', exitCode: 1 };
        }

        let signal = 'SIGTERM';
        let jobId: number;

        if (args[0].startsWith('-')) {
          signal = args[0].slice(1);
          if (args.length < 2) {
            return { stdout: '', stderr: 'kill: missing job id', exitCode: 1 };
          }
          jobId = parseInt(args[1]);
        } else {
          jobId = parseInt(args[0]);
        }

        if (isNaN(jobId)) {
          return { stdout: '', stderr: 'kill: invalid job id', exitCode: 1 };
        }

        const success = this.processManager.killJob(jobId, signal);
        if (success) {
          return { stdout: `Job ${jobId} terminated`, stderr: '', exitCode: 0 };
        } else {
          return { stdout: '', stderr: `kill: job ${jobId} not found or already terminated`, exitCode: 1 };
        }
      }
    });

    // bg コマンド - ジョブをバックグラウンドで再開 🔄
    this.commands.set('bg', {
      name: 'bg',
      description: '停止中のジョブをバックグラウンドで再開します',
      usage: 'bg [job_id]',
      execute: async (args) => {
        let jobId: number;
        
        if (args.length === 0) {
          // 最後に停止したジョブを取得
          const stoppedJobs = this.processManager.listJobs().filter(job => job.status === 'stopped');
          if (stoppedJobs.length === 0) {
            return { stdout: '', stderr: 'bg: no stopped jobs', exitCode: 1 };
          }
          jobId = stoppedJobs[stoppedJobs.length - 1].id;
        } else {
          jobId = parseInt(args[0]);
          if (isNaN(jobId)) {
            return { stdout: '', stderr: 'bg: invalid job id', exitCode: 1 };
          }
        }

        const success = this.processManager.resumeJob(jobId, true);
        if (success) {
          return { stdout: `[${jobId}] continued in background`, stderr: '', exitCode: 0 };
        } else {
          return { stdout: '', stderr: `bg: job ${jobId} not found or not stopped`, exitCode: 1 };
        }
      }
    });

    // fg コマンド - ジョブをフォアグラウンドで再開 ⏩
    this.commands.set('fg', {
      name: 'fg',
      description: 'ジョブをフォアグラウンドで再開します',
      usage: 'fg [job_id]',
      execute: async (args) => {
        let jobId: number;
        
        if (args.length === 0) {
          // 最後に停止したジョブを取得
          const stoppedJobs = this.processManager.listJobs().filter(job => job.status === 'stopped');
          if (stoppedJobs.length === 0) {
            return { stdout: '', stderr: 'fg: no stopped jobs', exitCode: 1 };
          }
          jobId = stoppedJobs[stoppedJobs.length - 1].id;
        } else {
          jobId = parseInt(args[0]);
          if (isNaN(jobId)) {
            return { stdout: '', stderr: 'fg: invalid job id', exitCode: 1 };
          }
        }

        const success = this.processManager.resumeJob(jobId, false);
        if (success) {
          return { stdout: `[${jobId}] continued in foreground`, stderr: '', exitCode: 0 };
        } else {
          return { stdout: '', stderr: `fg: job ${jobId} not found or not stopped`, exitCode: 1 };
        }
      }
    });

    // pty コマンド - インタラクティブPTYモード 🔌
    this.commands.set('pty', {
      name: 'pty',
      description: 'インタラクティブPTYモードを開始します',
      usage: 'pty [shell_path]',
      execute: async (args) => {
        try {
          const shell = args.length > 0 ? args[0] : undefined;
          const session = await this.ptyManager.startInteractiveMode();
          return { stdout: `PTY session started: ${session.id}`, stderr: '', exitCode: 0 };
        } catch (error) {
          return { stdout: '', stderr: `Failed to start PTY: ${error instanceof Error ? error.message : 'Unknown error'}`, exitCode: 1 };
        }
      }
    });

    // pty-list コマンド - PTYセッション一覧 📋
    this.commands.set('pty-list', {
      name: 'pty-list',
      description: 'アクティブなPTYセッションを表示します',
      execute: async () => {
        const sessions = this.ptyManager.getActiveSessions();
        if (sessions.length === 0) {
          return { stdout: 'No active PTY sessions', stderr: '', exitCode: 0 };
        }

        const sessionsList = sessions.map(session => {
          const duration = Math.round((Date.now() - session.startTime.getTime()) / 1000);
          const lastActivity = Math.round((Date.now() - session.lastActivity.getTime()) / 1000);
          return `🔌 ${session.id} (PID: ${session.ptyProcess.pid}, Duration: ${duration}s, Last activity: ${lastActivity}s ago)`;
        }).join('\n');

        return { stdout: sessionsList, stderr: '', exitCode: 0 };
      }
    });

    // pty-kill コマンド - PTYセッション終了 ☠️
    this.commands.set('pty-kill', {
      name: 'pty-kill',
      description: 'PTYセッションを終了します',
      usage: 'pty-kill session_id',
      execute: async (args) => {
        if (args.length === 0) {
          return { stdout: '', stderr: 'pty-kill: missing session id', exitCode: 1 };
        }

        const sessionId = args[0];
        const success = this.ptyManager.killSession(sessionId);
        
        if (success) {
          return { stdout: `PTY session ${sessionId} terminated`, stderr: '', exitCode: 0 };
        } else {
          return { stdout: '', stderr: `pty-kill: session ${sessionId} not found`, exitCode: 1 };
        }
      }
    });

    // pty-switch コマンド - PTYセッション切り替え 🔄
    this.commands.set('pty-switch', {
      name: 'pty-switch',
      description: 'アクティブなPTYセッションを切り替えます',
      usage: 'pty-switch session_id',
      execute: async (args) => {
        if (args.length === 0) {
          return { stdout: '', stderr: 'pty-switch: missing session id', exitCode: 1 };
        }

        const sessionId = args[0];
        const success = this.ptyManager.setActiveSession(sessionId);
        
        if (success) {
          return { stdout: `Switched to PTY session: ${sessionId}`, stderr: '', exitCode: 0 };
        } else {
          return { stdout: '', stderr: `pty-switch: session ${sessionId} not found`, exitCode: 1 };
        }
      }
    });

    // js コマンド - JavaScript実行 🚀
    this.commands.set('js', {
      name: 'js',
      description: 'JavaScript式を実行します（パイプライン対応）',
      usage: 'js \'JavaScript-expression\'',
      execute: async (args) => {
        if (args.length === 0) {
          return { stdout: '', stderr: 'js: missing JavaScript expression', exitCode: 1 };
        }

        const code = args.join(' ');
        
        // スタンドアロン実行（パイプライン外）
        return this.jsPipeEngine.executeJS(code);
      }
    });
  }

  private getPermissions(mode: number): string {
    const perms = [];
    const masks = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001];
    const chars = ['r', 'w', 'x', 'r', 'w', 'x', 'r', 'w', 'x'];
    
    for (let i = 0; i < masks.length; i++) {
      perms.push((mode & masks[i]) ? chars[i] : '-');
    }
    
    return perms.join('');
  }

  hasCommand(name: string): boolean {
    return this.commands.has(name);
  }

  async execute(name: string, args: string[]): Promise<CommandResult> {
    const command = this.commands.get(name);
    if (!command) {
      return { stdout: '', stderr: `Command not found: ${name}`, exitCode: 127 };
    }

    return command.execute(args, {
      currentDirectory: process.cwd(),
      env: process.env as Record<string, string>,
    });
  }

  getCommands(): ShellCommand[] {
    return Array.from(this.commands.values());
  }

  getProcessManager(): ProcessManager {
    return this.processManager;
  }

  getPtyManager(): PtyManager {
    return this.ptyManager;
  }
}
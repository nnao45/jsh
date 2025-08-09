import { ChildProcess, spawn } from 'child_process';

export interface Job {
  id: number;
  command: string;
  process: ChildProcess;
  status: 'running' | 'stopped' | 'completed';
  startTime: Date;
  endTime?: Date;
  background: boolean;
}

export class ProcessManager {
  private jobs: Map<number, Job> = new Map();
  private nextJobId: number = 1;
  private currentForegroundJob?: Job;

  // バックグラウンドジョブとして実行 🚀
  async runBackground(command: string, args: string[], options: any): Promise<Job> {
    const process = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    const job: Job = {
      id: this.nextJobId++,
      command: `${command} ${args.join(' ')}`,
      process,
      status: 'running',
      startTime: new Date(),
      background: true,
    };

    this.jobs.set(job.id, job);

    // プロセス終了時の処理 🏁
    process.on('exit', (code, signal) => {
      job.status = 'completed';
      job.endTime = new Date();
      console.log(`\n[${job.id}]+ Done    ${job.command}`);
    });

    // エラーハンドリング ❌
    process.on('error', (error) => {
      job.status = 'completed';
      job.endTime = new Date();
      console.error(`Job ${job.id} error:`, error.message);
    });

    console.log(`[${job.id}] ${process.pid} ${job.command}`);
    return job;
  }

  // フォアグラウンドジョブとして実行 ⚡
  async runForeground(command: string, args: string[], options: any): Promise<{ stdout: string, stderr: string, exitCode: number }> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        ...options,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      const job: Job = {
        id: this.nextJobId++,
        command: `${command} ${args.join(' ')}`,
        process,
        status: 'running',
        startTime: new Date(),
        background: false,
      };

      this.jobs.set(job.id, job);
      this.currentForegroundJob = job;

      let stdout = '';
      let stderr = '';

      if (process.stdout) {
        process.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          // リアルタイム表示はShellコンポーネントで処理
        });
      }

      if (process.stderr) {
        process.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          // リアルタイム表示はShellコンポーネントで処理
        });
      }

      process.on('exit', (code, signal) => {
        job.status = 'completed';
        job.endTime = new Date();
        this.currentForegroundJob = undefined;
        
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || (signal ? 1 : 0),
        });
      });

      process.on('error', (error) => {
        job.status = 'completed';
        job.endTime = new Date();
        this.currentForegroundJob = undefined;
        reject(error);
      });
    });
  }

  // ジョブ一覧表示 📋
  listJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  // アクティブなジョブのみ取得 🏃‍♂️
  getActiveJobs(): Job[] {
    return Array.from(this.jobs.values()).filter(job => job.status === 'running');
  }

  // ジョブをIDで取得 🔍
  getJob(id: number): Job | undefined {
    return this.jobs.get(id);
  }

  // ジョブを終了 ☠️
  killJob(id: number, signal: string = 'SIGTERM'): boolean {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'running') {
      return false;
    }

    try {
      job.process.kill(signal as any);
      job.status = 'stopped';
      job.endTime = new Date();
      return true;
    } catch (error) {
      console.error(`Failed to kill job ${id}:`, error);
      return false;
    }
  }

  // 現在のフォアグラウンドジョブを中断 ⏸️
  interruptForegroundJob(): boolean {
    if (!this.currentForegroundJob || this.currentForegroundJob.status !== 'running') {
      return false;
    }

    try {
      this.currentForegroundJob.process.kill('SIGINT');
      return true;
    } catch (error) {
      console.error('Failed to interrupt foreground job:', error);
      return false;
    }
  }

  // ジョブを待機状態にする 💤
  suspendJob(id: number): boolean {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'running') {
      return false;
    }

    try {
      job.process.kill('SIGSTOP');
      job.status = 'stopped';
      console.log(`\n[${job.id}]+ Stopped    ${job.command}`);
      return true;
    } catch (error) {
      console.error(`Failed to suspend job ${id}:`, error);
      return false;
    }
  }

  // 停止中のジョブを再開 🔄
  resumeJob(id: number, background: boolean = true): boolean {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'stopped') {
      return false;
    }

    try {
      job.process.kill('SIGCONT');
      job.status = 'running';
      
      if (background) {
        console.log(`[${job.id}] ${job.command} &`);
      } else {
        this.currentForegroundJob = job;
        console.log(`${job.command}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to resume job ${id}:`, error);
      return false;
    }
  }

  // 完了したジョブを削除 🗑️
  cleanupCompletedJobs(): void {
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed') {
        this.jobs.delete(id);
      }
    }
  }

  // すべてのアクティブなジョブを強制終了 💥
  killAllJobs(): void {
    for (const job of this.getActiveJobs()) {
      this.killJob(job.id, 'SIGKILL');
    }
  }

  // 現在のフォアグラウンドジョブ取得 📍
  getCurrentForegroundJob(): Job | undefined {
    return this.currentForegroundJob;
  }
}
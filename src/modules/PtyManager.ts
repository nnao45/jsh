import * as pty from 'node-pty';
import os from 'os';

export interface PtySession {
  id: string;
  ptyProcess: pty.IPty;
  isActive: boolean;
  startTime: Date;
  lastActivity: Date;
}

export class PtyManager {
  private sessions: Map<string, PtySession> = new Map();
  private currentSession?: PtySession;
  private nextSessionId: number = 1;

  // 新しいPTYセッションを作成 🆕
  createSession(shell: string = process.env.SHELL || '/bin/bash'): PtySession {
    const sessionId = `pty_${this.nextSessionId++}`;
    
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
      cwd: process.cwd(),
      env: process.env as { [key: string]: string },
    });

    const session: PtySession = {
      id: sessionId,
      ptyProcess,
      isActive: true,
      startTime: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, session);
    
    // データイベントリスナー設定 📡
    ptyProcess.onData((data) => {
      session.lastActivity = new Date();
      this.handlePtyOutput(session, data);
    });

    // 終了イベントリスナー設定 🏁
    ptyProcess.onExit(({exitCode, signal}) => {
      console.log(`PTY session ${sessionId} exited with code: ${exitCode}, signal: ${signal}`);
      session.isActive = false;
      this.sessions.delete(sessionId);
      
      if (this.currentSession?.id === sessionId) {
        this.currentSession = undefined;
      }
    });

    console.log(`🔌 Created PTY session: ${sessionId} (PID: ${ptyProcess.pid})`);
    return session;
  }

  // PTYセッションの出力処理 📤
  private handlePtyOutput(session: PtySession, data: string): void {
    // リアルタイムで出力をストリーム
    if (session.id === this.currentSession?.id) {
      process.stdout.write(data);
    }
    
    // ここで出力データを記録したり、処理したりできます
    // 例: ログファイルに保存、特定のパターンをキャッチなど
  }

  // PTYセッションにコマンドを送信 ⌨️
  writeToSession(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    session.ptyProcess.write(data);
    session.lastActivity = new Date();
    return true;
  }

  // 現在のアクティブセッションを設定 🎯
  setActiveSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    this.currentSession = session;
    console.log(`🔄 Switched to PTY session: ${sessionId}`);
    return true;
  }

  // 現在のアクティブセッション取得 📍
  getActiveSession(): PtySession | undefined {
    return this.currentSession;
  }

  // セッション一覧取得 📋
  listSessions(): PtySession[] {
    return Array.from(this.sessions.values());
  }

  // アクティブなセッションのみ取得 🏃‍♂️
  getActiveSessions(): PtySession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  // セッションを終了 ☠️
  killSession(sessionId: string, signal: string = 'SIGTERM'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      session.ptyProcess.kill(signal);
      session.isActive = false;
      
      if (this.currentSession?.id === sessionId) {
        this.currentSession = undefined;
      }
      
      console.log(`💀 Killed PTY session: ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`Failed to kill PTY session ${sessionId}:`, error);
      return false;
    }
  }

  // セッションのサイズを変更 📏
  resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    try {
      session.ptyProcess.resize(cols, rows);
      return true;
    } catch (error) {
      console.error(`Failed to resize PTY session ${sessionId}:`, error);
      return false;
    }
  }

  // インタラクティブシェルモードを開始 🐚
  async startInteractiveMode(): Promise<PtySession> {
    const defaultShell = os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash';
    const session = this.createSession(defaultShell);
    this.setActiveSession(session.id);

    // 標準入力からの入力を PTY に転送 ⌨️
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (data) => {
      if (this.currentSession) {
        // Ctrl+C (ASCII 3) の特別処理
        if (data.toString() === '\u0003') {
          this.currentSession.ptyProcess.write(data.toString());
        }
        // Ctrl+D (ASCII 4) でセッション終了
        else if (data.toString() === '\u0004') {
          this.killSession(this.currentSession.id);
          process.exit(0);
        }
        // その他の入力
        else {
          this.currentSession.ptyProcess.write(data.toString());
        }
      }
    });

    // ターミナルサイズ変更の処理 📐
    process.stdout.on('resize', () => {
      if (this.currentSession) {
        const { columns, rows } = process.stdout;
        this.resizeSession(this.currentSession.id, columns || 80, rows || 24);
      }
    });

    console.log(`\n🚀 Started interactive PTY mode with session: ${session.id}`);
    console.log(`💡 Press Ctrl+D to exit interactive mode\n`);

    return session;
  }

  // インタラクティブモードを終了 🛑
  stopInteractiveMode(): void {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    
    if (this.currentSession) {
      console.log(`\n🛑 Exited interactive mode from session: ${this.currentSession.id}\n`);
      this.currentSession = undefined;
    }
  }

  // 非アクティブなセッションをクリーンアップ 🧹
  cleanupInactiveSessions(): void {
    const inactiveSessions = Array.from(this.sessions.entries())
      .filter(([_, session]) => !session.isActive);

    for (const [sessionId, _] of inactiveSessions) {
      this.sessions.delete(sessionId);
      console.log(`🗑️ Cleaned up inactive PTY session: ${sessionId}`);
    }
  }

  // すべてのセッションを終了 💥
  killAllSessions(): void {
    for (const sessionId of this.sessions.keys()) {
      this.killSession(sessionId, 'SIGKILL');
    }
    this.currentSession = undefined;
    console.log('💥 Killed all PTY sessions');
  }
}
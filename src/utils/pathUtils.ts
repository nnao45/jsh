import os from 'os';
import path from 'path';

/**
 * パスを短縮表示用に変換（ホームディレクトリを~に）
 */
export function getShortPath(fullPath: string): string {
  const home = os.homedir();
  if (fullPath.startsWith(home)) {
    return fullPath.replace(home, '~');
  }
  return fullPath;
}

/**
 * ホスト名を取得（短縮版）
 */
export function getShortHostname(): string {
  const hostname = os.hostname();
  // ドット区切りの最初の部分のみを返す（例：user.local → user）
  return hostname.split('.')[0];
}

/**
 * プロンプト行全体を生成
 * 形式: user@hostname:~/current/path $ 
 */
export function generatePromptLine(currentDirectory: string, user?: string): string {
  const username = user || os.userInfo().username;
  const hostname = getShortHostname();
  const shortPath = getShortPath(currentDirectory);
  
  return `${username}@${hostname}:${shortPath} $ `;
}
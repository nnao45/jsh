#!/usr/bin/env tsx

import React from 'react';
import { render } from 'ink';
import { Shell } from './src/components/Shell.js';

// デモ用のシンプルなシェル起動スクリプト 🚀
console.log('🎮 InkSh Demo - 本格的シェル体験！');
console.log('');
console.log('✨ 新機能 - シェルライクなEnter動作:');
console.log('  • Enter      - コマンド実行後に新しいプロンプトを表示');
console.log('  • 空Enter    - 新しいプロンプトライン追加');
console.log('  • ↑/↓       - コマンド履歴ナビゲーション');
console.log('');
console.log('🎯 ZSH風タブ補完:');
console.log('  • Tab        - 次の候補を選択');
console.log('  • Shift+Tab  - 前の候補を選択');
console.log('  • ↑/↓       - 候補をスクロール');
console.log('  • Enter      - 候補を確定');
console.log('  • Esc        - 補完をキャンセル');
console.log('');
console.log('💡 試してみてください:');
console.log('  - "help" + Enter (ヘルプを見る)');
console.log('  - "h" + Tab (コマンド補完 - helpが補完される)');
console.log('  - "ls src/" + Tab (ディレクトリ内容補完)');
console.log('  - "cd /tm" + Tab (パス補完 - /tmpが候補に)');
console.log('  - 空でEnter (新しいプロンプト)');
console.log('  - ↑キー (履歴を辿る)');
console.log('');
console.log('✨ 新機能: 入力した部分は残り、その後に候補が追加されます！');
console.log('');

render(React.createElement(Shell));
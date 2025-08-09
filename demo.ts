#!/usr/bin/env tsx

import React from 'react';
import { render } from 'ink';
import { Shell } from './src/components/Shell.js';

// デモ用のシンプルなシェル起動スクリプト 🚀
console.log('🎮 InkSh Demo - ZSH風タブ補完デモ');
console.log('');
console.log('📝 タブ補完の使い方:');
console.log('  • Tab        - 次の候補を選択');
console.log('  • Shift+Tab  - 前の候補を選択');
console.log('  • ↑/↓       - 候補をスクロール');
console.log('  • Enter      - 候補を確定');
console.log('  • Esc        - 補完をキャンセル');
console.log('');
console.log('💡 試してみてください: "h" + Tab, "ls" + Tab, "src/" + Tab');
console.log('');

render(React.createElement(Shell));
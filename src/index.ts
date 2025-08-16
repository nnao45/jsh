#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { Shell } from './components/Shell.js';

// Welcome message 🎉
console.log('🌈 Welcome to JSH - Next-Generation Interactive Shell! ✨');
console.log('💡 Type "help" to see available commands');
console.log('👋 Type "exit" to quit');
console.log('');

// メインのShellコンポーネントを起動 🚀
// fullScreen: false でスクロールバックバッファを維持
render(React.createElement(Shell), {
  debug: false,
  exitOnCtrlC: false,
  patchConsole: false,
});
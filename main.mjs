import { runParser } from './src/api/index.mjs';
import { showMenu } from './src/utils/menu.mjs';
import fs from 'fs';
import { config } from './config/parser.config.mjs';

// Создаем необходимые директории
function createDirectories() {
  const dirs = [
    config.rbc.debugDir,
    config.lenta.debugDir,
    'output/rbc',
    'output/lenta'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Создана директория: ${dir}`);
    }
  });
}

async function main() {
  try {
    console.log('Создание структуры директорий...');
    createDirectories();
    console.log('Структура директорий готова\n');
    
    while (true) {
      const site = await showMenu();
      if (site) {
        await runParser(site);
      }
    }
  } catch (error) {
    console.error('Произошла ошибка:', error);
    process.exit(1);
  }
}

main();

import readline from 'readline';

export async function showMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\nВыберите сайт для парсинга:');
    console.log('1. РБК');
    console.log('2. Lenta.ru');
    console.log('3. Выход');
    
    rl.question('Введите номер: ', (answer) => {
      rl.close();
      
      switch (answer.trim()) {
        case '1':
          resolve('rbc');
          break;
        case '2':
          resolve('lenta');
          break;
        case '3':
          console.log('До свидания!');
          process.exit(0);
          break;
        default:
          console.log('Неверный выбор. Попробуйте снова.');
          resolve(showMenu());
      }
    });
  });
} 

import fs from 'fs';

// Логирование ошибок
export function logError(message, error, articleUrl = '') {
  console.error(message, error.message);
  fs.appendFileSync('error-log.txt', 
    `\n[${new Date().toISOString()}] ${message} ${articleUrl ? `(URL: ${articleUrl})` : ''}: ${error.message}\n${error.stack}\n`);
}

export function saveToJson(data, filename) {
  if (!data || !data.length) {
    console.error('Нет данных для сохранения в JSON');
    return;
  }
  fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Данные сохранены в файл: ${filename}`);
}

export function saveToCsv(data, filename) {
  if (!data || !data.length) {
    console.error('Нет данных для сохранения в CSV');
    return;
  }
  
  // Определяем все возможные заголовки из данных
  const allKeys = new Set();
  data.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key));
  });
  
  const headers = Array.from(allKeys);
  
  const rows = data.map(item => 
    headers.map(header => {
      const value = item[header];
      if (value === undefined || value === null) return '""';
      if (typeof value === 'object' && !Array.isArray(value)) {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      if (Array.isArray(value)) {
        return `"${value.join('; ').replace(/"/g, '""')}"`;
      }
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',')
  );
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(filename, '\ufeff' + csvContent, 'utf8');
  console.log(`Данные сохранены в файл: ${filename}`);
} 

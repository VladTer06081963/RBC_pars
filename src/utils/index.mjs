import fs from 'fs/promises';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function tryWithRetry(fn, maxRetries = 3, retryDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            console.log(`Попытка ${attempt}/${maxRetries} не удалась. Повторяю...`);
            lastError = error;
            await delay(retryDelay);
        }
    }
    throw lastError;
}

export function getCategory(url) {
    if (url.includes('/politics/')) return 'Политика';
    if (url.includes('/economics/')) return 'Экономика';
    if (url.includes('/society/')) return 'Общество';
    if (url.includes('/rbcfreenews/')) return 'Срочные новости';
    return 'Новости';
}

export function getTextSentiment(text) {
    const positiveWords = ['рост', 'успех', 'подъем', 'положительный', 'хороший', 'выгод', 'развити'];
    const negativeWords = ['падение', 'снижение', 'кризис', 'проблема', 'конфликт', 'спад', 'риск'];

    let positiveScore = 0;
    let negativeScore = 0;

    const words = text.toLowerCase().split(/\s+/);

    words.forEach(word => {
        if (positiveWords.some(w => word.includes(w))) positiveScore++;
        if (negativeWords.some(w => word.includes(w))) negativeScore++;
    });

    return {
        positive: positiveScore,
        negative: negativeScore,
        neutral: words.length - positiveScore - negativeScore,
        sentiment: positiveScore > negativeScore ? 'positive' :
            negativeScore > positiveScore ? 'negative' : 'neutral'
    };
}


export async function logError(message, error, articleUrl = '') {
    try {
        await fs.appendFile('error.log', `\n${new Date().toISOString()}: ${message} ${articleUrl ? `(URL: ${articleUrl})` : ''}: ${error.message}\n${error.stack}\n`);
    } catch (err) {
        console.error("Ошибка записи в лог:", err);
    }
}

export async function saveToJson(data, filename) {
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`Данные сохранены в файл: ${filename}`);
}

export async function saveToCsv(data, filename) {
    if (!data || !data.length) {
        console.error('Нет данных для сохранения в CSV');
        return;
    }

    const allKeys = new Set();
    data.forEach(item => Object.keys(item).forEach(key => allKeys.add(key)));
    const headers = Array.from(allKeys);

    const rows = data.map(item => headers.map(header => {
        const value = item[header];
        if (value === undefined || value === null) return '""';
        if (typeof value === 'object' && !Array.isArray(value)) {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        if (Array.isArray(value)) {
            return `"${value.join('; ').replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
    }).join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    await fs.writeFile(filename, '\ufeff' + csvContent);
    console.log(`Данные сохранены в файл: ${filename}`);
}

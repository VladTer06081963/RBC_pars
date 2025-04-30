// Функция задержки
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Функция с повторными попытками
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

// Определение категории по URL
export function getCategory(url) {
  if (url.includes('/politics/')) return 'Политика';
  if (url.includes('/economics/')) return 'Экономика';
  if (url.includes('/society/')) return 'Общество';
  if (url.includes('/rbcfreenews/')) return 'Срочные новости';
  return 'Новости';
}

// Простой анализ тональности текста
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

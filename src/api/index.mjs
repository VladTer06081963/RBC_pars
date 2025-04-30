import { config } from '../../config/parser.config.mjs';
import { parseRBCWebsite } from '../parsers/rbcParser.mjs';
import { parseLentaWebsite } from '../parsers/lentaParser.mjs';
import { saveToJson, saveToCsv, logError } from '../utils/fileUtils.mjs';

export async function runParser(site = 'rbc') {
  const siteConfig = config[site];
  if (!siteConfig) {
    console.error(`Неизвестный сайт: ${site}`);
    return;
  }

  console.log(`Начинаем парсинг сайта ${siteConfig.url}`);
  console.log(`Дата и время запуска: ${new Date().toLocaleString()}`);
  
  const startTime = Date.now();
  
  try {
    let articles;
    if (site === 'rbc') {
      articles = await parseRBCWebsite(siteConfig.url, siteConfig.maxArticles);
    } else if (site === 'lenta') {
      articles = await parseLentaWebsite(siteConfig.url, siteConfig.maxArticles);
    }
    
    if (articles && articles.length > 0) {
      // Фильтруем статьи без контента
      const validArticles = articles.filter(article => article.content && article.content.trim().length > 0);
      
      if (validArticles.length > 0) {
        saveToJson(validArticles, siteConfig.outputJsonFile);
        saveToCsv(validArticles, siteConfig.outputCsvFile);
        
        // Сохраняем статистику
        const stats = {
          totalArticles: articles.length,
          articlesWithContent: validArticles.length,
          articlesWithTags: validArticles.filter(a => a.tags && a.tags.length > 0).length,
          articlesWithImages: validArticles.filter(a => a.imageUrl).length,
          articlesWithVideos: validArticles.filter(a => a.hasVideo).length,
          categoriesCount: Object.entries(
            validArticles.reduce((acc, article) => {
              acc[article.category] = (acc[article.category] || 0) + 1;
              return acc;
            }, {})
          ),
          sentimentStats: {
            positive: validArticles.filter(a => a.sentiment && a.sentiment.sentiment === 'positive').length,
            negative: validArticles.filter(a => a.sentiment && a.sentiment.sentiment === 'negative').length,
            neutral: validArticles.filter(a => a.sentiment && a.sentiment.sentiment === 'neutral').length,
          },
          executionTimeMs: Date.now() - startTime
        };
        
        console.log('Статистика:');
        console.log(JSON.stringify(stats, null, 2));
        saveToJson(stats, `parsing-stats-${site}.json`);
        
        console.log(`Парсинг завершен успешно за ${(stats.executionTimeMs / 1000).toFixed(2)} секунд`);
        console.log(`Успешно обработано статей: ${validArticles.length} из ${articles.length}`);
      } else {
        console.error('Не удалось получить контент ни для одной статьи');
      }
    } else {
      console.error('Не удалось получить статьи');
    }
  } catch (error) {
    logError('Критическая ошибка при выполнении парсера', error);
    console.error('Парсинг завершен с ошибками');
  }
} 

import puppeteer from 'puppeteer';
import fs from 'fs';
import cliProgress from 'cli-progress';
import { config } from '../../config/parser.config.mjs';
import { tryWithRetry, getTextSentiment } from '../utils/helpers.mjs';
import { logError } from '../utils/fileUtils.mjs';

// Функция определения категории для Lenta.ru
function getLentaCategory(url) {
  if (url.includes('/politics/')) return 'Политика';
  if (url.includes('/economics/')) return 'Экономика';
  if (url.includes('/society/')) return 'Общество';
  if (url.includes('/world/')) return 'Мир';
  if (url.includes('/science/')) return 'Наука';
  return 'Новости';
}

export async function parseLentaWebsite(url = config.lenta.url, maxArticles = config.lenta.maxArticles) {
  console.log(`Начинаю парсинг сайта: ${url}`);
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-notifications',
      '--disable-popup-blocking'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Блокируем рекламу и тяжелый контент
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (
        request.resourceType() === 'image' ||
        request.resourceType() === 'media' ||
        request.resourceType() === 'font' ||
        request.url().includes('advertising') ||
        request.url().includes('analytics') ||
        request.url().endsWith('.css')
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    // Загружаем страницу с повторными попытками
    await tryWithRetry(() => 
      page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.lenta.timeout })
    );
    
    console.log('Страница загружена');
    
    // Сохраняем HTML для отладки
    const html = await page.content();
    fs.writeFileSync(`${config.lenta.debugDir}/main.html`, html, 'utf8');
    console.log('Сохранен HTML страницы для отладки');

    // Получаем список статей
    const articles = await page.evaluate((selectors) => {
      const articleElements = Array.from(document.querySelectorAll(selectors.articleLinks));
      return articleElements.map(element => ({
        title: element.innerText.trim(),
        url: element.href
      })).filter(article => article.title && article.url);
    }, config.lenta.selectors);

    const uniqueArticles = [...new Map(articles.map(item => [item.url, item])).values()];
    const limitedArticles = uniqueArticles.slice(0, maxArticles);
    
    console.log(`Найдено уникальных статей: ${uniqueArticles.length}, обрабатываю первые ${limitedArticles.length}`);

    // Создаем прогресс-бар
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(limitedArticles.length, 0);

    // Параллельная обработка статей
    const detailedArticlesPromises = limitedArticles.map(async (article, index) => {
      const articlePage = await browser.newPage();
      await articlePage.setRequestInterception(true);
      articlePage.on('request', (request) => {
        if (
          request.resourceType() === 'image' ||
          request.resourceType() === 'media' ||
          request.resourceType() === 'font' ||
          request.url().includes('advertising')
        ) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      await articlePage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      
      try {
        await tryWithRetry(() => 
          articlePage.goto(article.url, { waitUntil: 'domcontentloaded', timeout: config.lenta.articleTimeout })
        );
        
        // Ждем загрузки контента с альтернативными селекторами
        await articlePage.waitForSelector(config.lenta.selectors.content.split(',')[0], { timeout: 10000 })
          .catch(() => {
            console.warn(`Предупреждение: не удалось дождаться контента для статьи "${article.title}"`);
            return articlePage.waitForSelector(config.lenta.selectors.content.split(',')[1], { timeout: 5000 })
              .catch(() => articlePage.waitForSelector(config.lenta.selectors.content.split(',')[2], { timeout: 5000 }));
          });
        
        // Сохраняем HTML статьи для отладки (только для первых трех статей)
        if (index < 3) {
          const articleHtml = await articlePage.content();
          fs.writeFileSync(`${config.lenta.debugDir}/article-${index + 1}.html`, articleHtml, 'utf8');
        }
        
        const details = await articlePage.evaluate((selectors) => {
          const getElementText = selector => {
            const elements = Array.from(document.querySelectorAll(selector));
            return elements.map(el => el.innerText.trim()).join('\n');
          };
          
          const getElementAttr = (selector, attr) => {
            const element = document.querySelector(selector);
            return element ? (element.getAttribute(attr) || element.innerText.trim()) : '';
          };
          
          // Пробуем все селекторы контента
          const content = selectors.content.split(',').reduce((acc, selector) => {
            if (acc) return acc;
            const element = document.querySelector(selector);
            return element ? element.innerText.trim() : '';
          }, '');
          
          const authorElement = document.querySelector(selectors.author);
          const author = authorElement ? authorElement.innerText.trim() : 'Lenta.ru';
          
          // Улучшенная обработка тегов
          const tags = selectors.tags.split(',').reduce((acc, selector) => {
            if (acc.length > 0) return acc;
            const elements = Array.from(document.querySelectorAll(selector));
            return elements.map(el => el.innerText.trim()).filter(tag => tag.length > 0);
          }, []);
          
          const publishedAt = getElementAttr(selectors.publishedAt, 'datetime') || 
                             getElementText(selectors.publishedAt);
          
          const imageElement = document.querySelector(selectors.image);
          const imageUrl = imageElement ? imageElement.src : '';
          
          const hasVideo = !!document.querySelector('video, iframe[src*="youtube"]');
          
          return {
            content,
            author,
            tags,
            publishedAt,
            imageUrl,
            hasVideo
          };
        }, config.lenta.selectors);
        
        await articlePage.close();
        progressBar.increment();
        
        const category = getLentaCategory(article.url);
        const sentiment = getTextSentiment(details.content);
        
        return {
          ...article,
          ...details,
          category,
          sentiment,
          parsedAt: new Date().toISOString()
        };
      } catch (error) {
        await articlePage.close();
        logError(`Ошибка при парсинге статьи`, error, article.url);
        
        progressBar.increment();
        
        return {
          ...article,
          category: getLentaCategory(article.url),
          content: '',
          author: 'Lenta.ru',
          tags: [],
          hasVideo: false,
          parsedAt: new Date().toISOString(),
          error: error.message
        };
      }
    });

    const detailedArticles = await Promise.all(detailedArticlesPromises);
    progressBar.stop();
    
    const validArticles = detailedArticles.filter(article => article.content);
    const invalidArticles = detailedArticles.filter(article => !article.content);
    
    console.log(`Успешно обработано статей: ${validArticles.length}`);
    
    if (invalidArticles.length > 0) {
      console.warn(`Предупреждение: ${invalidArticles.length} статей не содержат контента`);
      fs.writeFileSync(`${config.lenta.debugDir}/failed-articles.json`, JSON.stringify(invalidArticles, null, 2), 'utf8');
    }
    
    return detailedArticles;
    
  } catch (error) {
    logError('Произошла общая ошибка при парсинге', error);
    return [];
  } finally {
    await browser.close();
    console.log('Браузер закрыт');
  }
} 

import puppeteer from 'puppeteer';
import fs from 'fs';
import cliProgress from 'cli-progress';
import { config } from '../../config/parser.config.mjs';
import { tryWithRetry, getCategory, getTextSentiment } from '../utils/helpers.mjs';
import { logError } from '../utils/fileUtils.mjs';

export async function parseRBCWebsite(url = config.rbc.url, maxArticles = config.rbc.maxArticles) {
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
      page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.rbc.timeout })
    );
    
    console.log('Страница загружена');
    
    // Создаем директорию для отладки, если её нет
    if (!fs.existsSync(config.rbc.debugDir)) {
      fs.mkdirSync(config.rbc.debugDir, { recursive: true });
    }
    
    // Сохраняем HTML для отладки
    const html = await page.content();
    fs.writeFileSync(`${config.rbc.debugDir}/main.html`, html, 'utf8');
    console.log('Сохранен HTML страницы для отладки');

    // Получаем список статей
    const articles = await page.evaluate((selectors) => {
      const articleElements = Array.from(document.querySelectorAll(selectors.articleLinks));
      return articleElements.map(element => ({
        title: element.innerText.trim(),
        url: element.href
      })).filter(article => article.title && article.url);
    }, config.rbc.selectors);

    const uniqueArticles = [...new Map(articles.map(item => [item.url, item])).values()];
    const limitedArticles = uniqueArticles.slice(0, maxArticles);
    
    console.log(`Найдено уникальных статей: ${uniqueArticles.length}, обрабатываю первые ${limitedArticles.length}`);

    // Создаем прогресс-бар
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(limitedArticles.length, 0);

    // Параллельная обработка статей
    const detailedArticlesPromises = limitedArticles.map(async (article, index) => {
      // Создаем новую страницу для каждой статьи
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
        // Переходим на страницу статьи с повторными попытками
        console.log(`\nОбработка статьи: ${article.title}`);
        console.log(`URL: ${article.url}`);
        
        await tryWithRetry(() => 
          articlePage.goto(article.url, { 
            waitUntil: ['domcontentloaded', 'networkidle0'],
            timeout: config.rbc.articleTimeout 
          })
        );
        
        console.log('Страница статьи загружена');
        
        // Ждем загрузки контента с альтернативными селекторами
        const contentSelectors = config.rbc.selectors.content.split(',');
        console.log('Проверка селекторов контента:', contentSelectors);
        
        let contentLoaded = false;
        for (const selector of contentSelectors) {
          try {
            console.log(`Попытка найти контент по селектору: ${selector}`);
            await articlePage.waitForSelector(selector, { timeout: 5000 });
            console.log(`Контент найден по селектору: ${selector}`);
            contentLoaded = true;
            break;
          } catch (error) {
            console.log(`Не удалось найти контент по селектору: ${selector}`);
          }
        }
        
        if (!contentLoaded) {
          console.warn(`Не удалось найти контент для статьи "${article.title}"`);
        }
        
        // Сохраняем HTML статьи для отладки (только для первых трех статей)
        if (index < 3) {
          console.log(`Сохранение HTML статьи ${index + 1}...`);
          const articleHtml = await articlePage.content();
          const debugPath = `${config.rbc.debugDir}/article-${index + 1}.html`;
          fs.writeFileSync(debugPath, articleHtml, 'utf8');
          console.log(`HTML статьи ${index + 1} сохранен: ${debugPath}`);
          
          // Сохраняем скриншот для отладки
          await articlePage.screenshot({
            path: `${config.rbc.debugDir}/article-${index + 1}.png`,
            fullPage: true
          });
          console.log(`Скриншот статьи ${index + 1} сохранен`);
        }
        
        // Извлекаем информацию
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
          const author = authorElement ? authorElement.innerText.trim() : 'РБК';
          
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
        }, config.rbc.selectors);
        
        // Закрываем страницу статьи
        await articlePage.close();
        
        // Обновляем прогресс-бар
        progressBar.increment();
        
        // Определяем категорию и анализируем тональность
        const category = getCategory(article.url);
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
        
        // Обновляем прогресс-бар даже при ошибке
        progressBar.increment();
        
        return {
          ...article,
          category: getCategory(article.url),
          content: '',
          author: 'РБК',
          tags: [],
          hasVideo: false,
          parsedAt: new Date().toISOString(),
          error: error.message
        };
      }
    });

    // Ожидаем завершения обработки всех статей
    const detailedArticles = await Promise.all(detailedArticlesPromises);
    
    // Останавливаем прогресс-бар
    progressBar.stop();
    
    // Фильтруем статьи без контента
    const validArticles = detailedArticles.filter(article => article.content);
    const invalidArticles = detailedArticles.filter(article => !article.content);
    
    console.log(`Успешно обработано статей: ${validArticles.length}`);
    
    if (invalidArticles.length > 0) {
      console.warn(`Предупреждение: ${invalidArticles.length} статей не содержат контента`);
      const failedPath = `${config.rbc.debugDir}/failed-articles.json`;
      fs.writeFileSync(failedPath, JSON.stringify(invalidArticles, null, 2), 'utf8');
      console.log(`Сохранена информация о неудачных статьях: ${failedPath}`);
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

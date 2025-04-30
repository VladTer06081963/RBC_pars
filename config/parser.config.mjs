export const config = {
  rbc: {
    url: 'https://www.rbc.ru/',
    maxArticles: 10,
    timeout: 60000,
    articleTimeout: 30000,
    outputJsonFile: 'output/rbc/articles.json',
    outputCsvFile: 'output/rbc/articles.csv',
    debugDir: 'output/rbc/debug',
    maxRetries: 3,
    retryDelay: 1000,
    selectors: {
      articleLinks: 'a[href*="/rbcfreenews/"], a[href*="/society/"], a[href*="/politics/"], a[href*="/economics/"]',
      content: '.article__text, .article__body, .article',
      author: '.article__authors, .article__author',
      tags: '.article__tags__item, .article__tags a, .article__tags span, .article__tags__link',
      publishedAt: '.article__date, time',
      image: '.article__main-image img, .article__picture img'
    }
  },
  // Пример конфигурации для другого сайта (например, Lenta.ru)
  lenta: {
    url: 'https://lenta.ru/',
    maxArticles: 10,
    timeout: 60000,
    articleTimeout: 30000,
    outputJsonFile: 'output/lenta/articles.json',
    outputCsvFile: 'output/lenta/articles.csv',
    debugDir: 'output/lenta/debug',
    maxRetries: 3,
    retryDelay: 1000,
    selectors: {
      articleLinks: 'a[href*="/news/"], a[href*="/articles/"]',
      content: '.topic-body__content, .topic-body__text, .topic-body__content-text',
      author: '.topic-authors__author, .topic-authors__item',
      tags: '.topic-tags__item, .topic-tags__link, .topic-tags__items a',
      publishedAt: '.topic-header__time, time[datetime]',
      image: '.topic-body__title-image img, .topic-body__image img'
    }
  }
}; 

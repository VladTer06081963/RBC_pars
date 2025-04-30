export default {
  sites: [
    {
      name: 'rbc',
      url: 'https://www.rbc.ru/',
      selectors: {
        articleLinks: 'a[href*="/rbcfreenews/"], a[href*="/society/"], a[href*="/politics/"], a[href*="/economics/"]',
        content: '.article__text, .article__body, .article',
        author: '.article__authors, .article__author',
        tags: '.article__tags a',
        publishedAt: '.article__date, time',
        image: '.article__main-image img, .article__picture img'
      },
      maxArticles: 10,
      timeout: 60000,
      articleTimeout: 30000
    }
  ],
  output: {
    jsonFile: 'rbc-articles.json',
    csvFile: 'rbc_news_articles.csv'
  },
  retry: {
    maxRetries: 3,
    retryDelay: 1000
  }
};

import puppeteer from 'puppeteer';
import { delay, tryWithRetry, logError } from '../utils/index.mjs';

export default async function parseWebsite(config) { // async перед function
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications', '--disable-popup-blocking'] });
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        await tryWithRetry(async () => await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: config.timeout }));

        const articles = await page.$$eval(config.selectors.articleLinks, links => links.map(link => ({ url: link.href, title: link.textContent.trim() })));

        return articles;
    } catch (error) {
        logError('Ошибка при парсинге сайта', error);
        throw error;
    } finally {
        await browser.close();
    }
}

export class Article {
  constructor(title, url, content, author, tags, publishedAt, imageUrl, hasVideo, category, sentiment, error = null) {
    this.title = title;
    this.url = url;
    this.content = content;
    this.author = author;
    this.tags = tags;
    this.publishedAt = publishedAt;
    this.imageUrl = imageUrl;
    this.hasVideo = hasVideo;
    this.category = category;
    this.sentiment = sentiment;
    this.error = error;
  }
}

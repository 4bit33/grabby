export const errorPatterns = {
  en: [
    {
      pattern: /Signature solving failed/i,
      title: "YouTube signature error",
      message: "YouTube changed their protection. Update yt-dlp to the latest version.",
      solution: "Run: yt-dlp -U"
    },
    {
      pattern: /n challenge solving failed/i,
      title: "YouTube challenge error",
      message: "YouTube's anti-bot protection is active. Try again or update yt-dlp.",
      solution: "Run: yt-dlp -U"
    },
    {
      pattern: /Supported filetypes for thumbnail embedding/i,
      title: "Thumbnail embedding not supported",
      message: "This format doesn't support embedded thumbnails. Supported: mp3, mkv, ogg, m4a, mp4.",
      solution: "Disable thumbnail embedding or choose a different format"
    },
    {
      pattern: /Video unavailable/i,
      title: "Video not available",
      message: "This video is private, deleted, or region-locked.",
      solution: "Check the URL or try a different video"
    },
    {
      pattern: /HTTP Error 403/i,
      title: "Access denied",
      message: "The server blocked the request. The video might be region-locked.",
      solution: "Try using a VPN or check if the video is available in your region"
    },
    {
      pattern: /HTTP Error 404/i,
      title: "Video not found",
      message: "The video doesn't exist or the URL is incorrect.",
      solution: "Check the URL and try again"
    },
    {
      pattern: /Unable to download webpage/i,
      title: "Connection error",
      message: "Cannot connect to the server. Check your internet connection.",
      solution: "Check your internet and try again"
    },
    {
      pattern: /Unsupported URL/i,
      title: "Unsupported platform",
      message: "This website is not supported by yt-dlp.",
      solution: "Check the list of supported sites: yt-dlp --list-extractors"
    },
    {
      pattern: /This video requires payment/i,
      title: "Paid content",
      message: "This video requires payment or subscription.",
      solution: "Cannot download paid content"
    },
    {
      pattern: /Private video/i,
      title: "Private video",
      message: "This video is private and cannot be downloaded.",
      solution: "Request access from the video owner"
    }
  ],
  uk: [
    {
      pattern: /Signature solving failed/i,
      title: "Помилка підпису YouTube",
      message: "YouTube змінив захист. Оновіть yt-dlp до останньої версії.",
      solution: "Виконайте: yt-dlp -U"
    },
    {
      pattern: /n challenge solving failed/i,
      title: "Помилка захисту YouTube",
      message: "Активний анти-бот захист YouTube. Спробуйте ще раз або оновіть yt-dlp.",
      solution: "Виконайте: yt-dlp -U"
    },
    {
      pattern: /Supported filetypes for thumbnail embedding/i,
      title: "Обкладинка не підтримується",
      message: "Цей формат не підтримує вбудовані обкладинки. Підтримуються: mp3, mkv, ogg, m4a, mp4.",
      solution: "Вимкніть обкладинку або оберіть інший формат"
    },
    {
      pattern: /Video unavailable/i,
      title: "Відео недоступне",
      message: "Це відео приватне, видалене або заблоковане в вашому регіоні.",
      solution: "Перевірте URL або спробуйте інше відео"
    },
    {
      pattern: /HTTP Error 403/i,
      title: "Доступ заборонено",
      message: "Сервер заблокував запит. Відео може бути недоступне у вашому регіоні.",
      solution: "Спробуйте VPN або перевірте доступність відео"
    },
    {
      pattern: /HTTP Error 404/i,
      title: "Відео не знайдено",
      message: "Відео не існує або URL неправильний.",
      solution: "Перевірте URL і спробуйте ще раз"
    },
    {
      pattern: /Unable to download webpage/i,
      title: "Помилка з'єднання",
      message: "Не вдається підключитися до сервера. Перевірте інтернет.",
      solution: "Перевірте інтернет і спробуйте ще раз"
    },
    {
      pattern: /Unsupported URL/i,
      title: "Платформа не підтримується",
      message: "Цей сайт не підтримується yt-dlp.",
      solution: "Перегляньте список підтримуваних сайтів: yt-dlp --list-extractors"
    },
    {
      pattern: /This video requires payment/i,
      title: "Платний контент",
      message: "Це відео потребує оплати або підписки.",
      solution: "Неможливо завантажити платний контент"
    },
    {
      pattern: /Private video/i,
      title: "Приватне відео",
      message: "Це відео приватне і не може бути завантажене.",
      solution: "Запросіть доступ у власника відео"
    }
  ]
};

export function parseError(errorText, language = 'uk') {
  const patterns = errorPatterns[language] || errorPatterns.uk;

  for (const error of patterns) {
    if (error.pattern.test(errorText)) {
      return {
        found: true,
        title: error.title,
        message: error.message,
        solution: error.solution,
        original: errorText
      };
    }
  }

  return {
    found: false,
    original: errorText
  };
}

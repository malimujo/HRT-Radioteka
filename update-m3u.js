const puppeteer = require('puppeteer');
const fs = require('fs');

async function updateM3U() {
  let browser;
  try {
    console.log('🚀 Pokrećem Chrome...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log('📄 Učitavam https://radio.hrt.hr/slusaonica/radioteka');
    await page.goto('https://radio.hrt.hr/slusaonica/radioteka', { 
      waitUntil: 'networkidle2'
    });
    
    await new Promise(r => setTimeout(r, 4000));
    
    const result = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href], script, img'));
      
      // 🎵 MP3 link
      for (const link of allLinks) {
        const href = link.href || link.src || link.getAttribute('data-src');
        if (href && href.includes('api.hrt.hr/media') && href.includes('.mp3')) {
          return { mp3: href, image: null };
        }
      }
      
      // 🖼️ Slika
      let imageUrl = null;
      for (const img of allLinks) {
        const src = img.src || img.getAttribute('data-src');
        if (src && src.includes('api.hrt.hr/media') && (src.includes('.webp') || src.includes('.jpg'))) {
          imageUrl = src;
          break;
        }
      }
      
      // 🎵 REGEX u scriptovima
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || script.innerHTML;
        const mp3Regex1 = new RegExp('"https?:\\\\\\/\\\\\\/api\\\\.hrt\\\\.hr\\\\\\/media[^"]*\\\\.mp3[^"]*"');
        const mp3Regex2 = new RegExp("'https?:\\\\\\/\\\\\\/api\\\\.hrt\\\\.hr\\\\\\/media[^']*\\\\.mp3[^']*'");
        const mp3Match1 = content.match(mp3Regex1);
        const mp3Match2 = content.match(mp3Regex2);
        if (mp3Match1) return { mp3: mp3Match1[0].slice(1, -1), image: imageUrl };
        if (mp3Match2) return { mp3: mp3Match2[0].slice(1, -1), image: imageUrl };
      }
      
      return { mp3: null, image: null };
    });
    
    console.log('🎵 MP3:', result.mp3);
    console.log('🖼️ Slika:', result.image);
    
    if (result.mp3) {
      // 🆕 PRVI MATCH = NAJNOVIJA EMISIJA (vrh stranice)
      const webTime = await page.evaluate(() => {
        const bodyText = document.body.innerText || document.body.textContent || '';
        // Pronađi datume/vremena
        const timeMatches = bodyText.match(/([Pp]on|[Uu]to|[Ss]ri|[Čč]et|[Pp]et|[Ss]ub|[Nn]ed)(?:to|ak)?[,.\s]+(\d{1,2})[.\s]+(\d{1,2})[.\s]*u[.\s]*(\d{1,2}):(\d{2})/gi);
        
        // ✅ PRVI match = najnovija emisija (obično na vrhu stranice)
        if (timeMatches && timeMatches.length > 0) {
          return timeMatches[0].trim();
        }
        return null;
      });
      
      const timeMatch = result.mp3.match(/(\d{4})(\d{2})(\d{2})(\d{6})\.mp3$/);
      let emisijaInfo = 'Najnovija';
      
      if (webTime) {
        emisijaInfo = webTime;
        console.log('🕐 Web vrijeme (prvi match):', webTime);
      } else if (timeM

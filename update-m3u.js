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
      
      for (const link of allLinks) {
        const href = link.href || link.src || link.getAttribute('data-src');
        if (href && href.includes('api.hrt.hr/media') && href.includes('.mp3')) {
          return { mp3: href, image: null };
        }
      }
      
      let imageUrl = null;
      for (const img of allLinks) {
        const src = img.src || img.getAttribute('data-src');
        if (src && src.includes('api.hrt.hr/media') && (src.includes('.webp') || src.includes('.jpg'))) {
          imageUrl = src;
          break;
        }
      }
      
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || script.innerHTML;
        const mp3Regex1 = /"https?:\/\/api\.hrt\.hr\/media[^"]*\.mp3[^"]*"/;
        const mp3Regex2 = /'https?:\/\/api\.hrt\.hr\/media[^']*\.mp3[^']*'/;
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
      const webTime = await page.evaluate(() => {
        const bodyText = document.body.innerText || document.body.textContent || '';
        const timeMatches = bodyText.match(/([Pp]on|[Uu]to|[Ss]ri|[Čč]et|[Pp]et|[Ss]ub|[Nn]ed)(?:to|ak)?[,.\s]+(\d{1,2})[.\s]+(\d{1,2})[.\s]*u[.\s]*(\d{1,2}):(\d{2})/gi);
        
        if (timeMatches) {
          // 🎯 RADIOTEKA SPECIFIČNO: traži 20:00 ili uzmi drugi match
          for (let i = 0; i < timeMatches.length; i++) {
            if (timeMatches[i].includes('20:00') || (i === 1)) {
              return timeMatches[i].trim();
            }
          }
          // Fallback na prvi
          return timeMatches[0].trim();
        }
        return null;
      });
      
      const timeMatch = result.mp3.match(/(\d{4})(\d{2})(\d{2})(\d{6})\.mp3$/);
      let emisijaInfo = 'Najnovija';
      
      // ✅ PRIORITET: MP3 filename > Web 20:00 > Web bilo koji
      if (timeMatch) {
        const godina = timeMatch[1];
        const mjesec = timeMatch[2];
        const dan = timeMatch[3];
        const vrijeme = timeMatch[4];
        const sat = vrijeme.slice(0,2);
        const minute = vrijeme.slice(2,4);
        emisijaInfo = `${dan}.${mjesec}. ${sat}:${minute}`;
        console.log('📅 IZ MP3 (prioritet):', emisijaInfo);
      } else if (webTime && webTime.includes('20:')) {
        emisijaInfo = webTime;
        console.log('🕐 Web 20:00:', webTime);
      } else if (webTime) {
        emisijaInfo = webTime;
        console.log('🕐 Web bilo koji:', webTime);
      }
      
      console.log('📅 Konačno:', emisijaInfo);
      
      const imageUrl = result.image || 'https://radio.hrt.hr/favicon.ico';
      const m3uContent = `#EXTM3U
#EXTINF:-1 tvg-logo="${imageUrl}" group-title="Dance",HRT Radioteka ${emisijaInfo}
${result.mp3}`;

      fs.writeFileSync('Radioteka.m3u', m3uContent);
      console.log('✅ Radioteka.m3u spreman!');
    } else {
      throw new Error('Nema MP3-a');
    }
    
  } catch (error) {
    console.error('❌', error.message);
    const fallbackContent = `#EXTM3U
#EXTINF:-1 tvg-logo="https://radio.hrt.hr/favicon.ico",HRT Radioteka Sri, 04.03. u 20:00
https://api.hrt.hr/media/28/da/20260304-radioteka-37328738-20260304200000.mp3`;
    fs.writeFileSync('Radioteka.m3u', fallbackContent);
    console.log('✅ Fallback spreman');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

updateM3U();

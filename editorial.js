'use strict';
document.documentElement.classList.add('js');
const $ = selector => document.querySelector(selector);
const menuButton = $('.menu-toggle');
const navigation = $('#navigation');
if (menuButton && navigation) {
  menuButton.hidden = false;
  const closeMenu = () => { navigation.classList.remove('is-open'); menuButton.setAttribute('aria-expanded', 'false'); };
  menuButton.addEventListener('click', () => {
    const open = navigation.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && navigation.classList.contains('is-open')) { closeMenu(); menuButton.focus(); } });
}
if ($('#today')) $('#today').textContent = new Intl.DateTimeFormat('tr-TR', {dateStyle:'long', timeZone:'Europe/Istanbul'}).format(new Date()) + ' · ILGIN';
async function getJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {signal:controller.signal, cache:'no-store'});
    if (!response.ok) throw new Error('Service unavailable');
    return await response.json();
  } finally { clearTimeout(timeout); }
}
function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function safeURL(value, hosts) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (hosts && !hosts.some(host => url.hostname === host || url.hostname.endsWith('.'+host))) return null;
    return url.href;
  } catch { return null; }
}
function outsideLink(text, href, className='text-link') {
  const a=element('a',text,className); a.href=href; a.target='_blank'; a.rel='noopener noreferrer'; return a;
}
async function loadNews() {
  const grid = $('#news-feed'); if (!grid) return;
  try {
    const data=await getJSON('https://n8n.ilgininsani.com/webhook/instagram-showcase');
    if (!Array.isArray(data)) throw new Error('No posts');
    const posts=data.filter(post => post && typeof post.caption==='string' && post.caption.trim() && safeURL(post.link,['instagram.com'])).slice(0,6);
    if (!posts.length) throw new Error('No posts');
    const fragment=document.createDocumentFragment();
    for (const post of posts) {
      const a=outsideLink('',safeURL(post.link,['instagram.com']),'news-card');
      const imageURL=safeURL(post.imageUrl);
      if (imageURL) {
        const img=element('img'); img.src=imageURL; img.alt=''; img.width=800; img.height=600; img.loading='lazy'; img.decoding='async'; img.referrerPolicy='no-referrer'; img.addEventListener('error',()=>{img.remove();},{once:true}); a.append(img);
      }
      a.append(element('span','ILGIN İNSANI · INSTAGRAM','eyebrow'));
      const caption=post.caption.trim();
      a.append(element('h3',caption.length>150 ? caption.slice(0,147)+'…' : caption));
      a.append(element('span','Paylaşımı görüntüle ↗','text-link')); fragment.append(a);
    }
    grid.replaceChildren(fragment); grid.classList.add('has-posts');
  } catch {
    const status=$('#feed-status');
    if(status) status.textContent='Son paylaşımlar şu anda burada görüntülenemiyor. Ilgın’dan haberleri Instagram hesabımızdan takip edebilirsin.';
  }
}
const weatherLabel = code => code===0?'Açık':code<=3?'Parçalı bulutlu':code<=48?'Sisli':code<=67?'Yağmurlu':code<=77?'Karlı':code<=82?'Sağanak yağışlı':code<=86?'Kar yağışlı':'Gök gürültülü';
async function loadWeather() {
  const target=$('#weather-data'); if(!target)return;
  try {
    const data=await getJSON('https://api.open-meteo.com/v1/forecast?latitude=38.28&longitude=31.91&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=Europe%2FIstanbul');
    const current=data.current;
    if(!current || !Number.isFinite(current.temperature_2m)) throw new Error('No weather');
    const temp=Math.round(current.temperature_2m)+'°';
    target.replaceChildren(element('p',temp,'temperature'),element('p',weatherLabel(current.weather_code)+' · Rüzgâr '+Math.round(current.wind_speed_10m)+' km/sa'));
    const daily=data.daily;
    if(daily && Array.isArray(daily.time)){
      const row=element('div',null,'forecast');
      daily.time.slice(0,3).forEach((date,i)=>{
        const item=element('span',new Intl.DateTimeFormat('tr-TR',{weekday:'short'}).format(new Date(date+'T12:00:00')));
        item.append(element('b',Math.round(daily.temperature_2m_max[i])+'° / '+Math.round(daily.temperature_2m_min[i])+'°'));row.append(item);
      });target.append(row);
    }
    target.append(element('p','Open-Meteo · Güncelleme '+current.time.replace('T',' '),'small'));
    if($('#weather-mini'))$('#weather-mini').textContent='Ilgın '+temp+' · '+weatherLabel(current.weather_code);
  } catch { target.replaceChildren(element('h3','Hava nasıl?'),element('p','Hava durumu şu anda alınamıyor. Güncel tahmin için MGM bağlantısını kullanabilirsin.')); }
}
async function loadPharmacy() {
  const target=$('#pharmacy-data'); if(!target)return;
  try {
    const data=await getJSON('https://n8n.ilgininsani.com/webhook/mobile-eczane');
    const list=Array.isArray(data)?(Array.isArray(data[0]?.liste)?data[0].liste:data):data?.liste;
    const records=Array.isArray(list)?list.filter(x=>x&&typeof x.ad==='string'&&x.ad.trim()):[];
    if(!records.length) throw new Error('No pharmacies');
    target.replaceChildren();
    records.slice(0,5).forEach(record=>{
      const article=element('div'); article.append(element('h3',record.ad));
      if(typeof record.aciklama==='string')article.append(element('p',record.aciklama));
      if(typeof record.adres==='string')article.append(element('p',record.adres));
      const phone=String(record.telefon||'').replace(/[^+\d]/g,'');
      if(phone.length>=10&&phone.length<=16){const call=element('a','Telefonla ara','button outline');call.href='tel:'+phone;article.append(call);}
      const lat=Number(record.lat),lon=Number(record.lon);
      if(record.lat!=null&&record.lon!=null&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180)article.append(outsideLink('Yol tarifi ↗','https://www.google.com/maps?q='+lat+','+lon));
      target.append(article);
    });
    target.append(element('p','Nöbet bilgisi mevcut şehir servisinden alınmıştır.','small'));
  } catch {
    target.replaceChildren(element('p','Güncel nöbetçi eczane bilgisi şu anda alınamıyor.'));
    const retry=element('button','Tekrar dene ↻','button outline');retry.type='button';retry.addEventListener('click',()=>{target.replaceChildren(element('p','Kontrol ediliyor…'));loadPharmacy();});target.append(retry);
  }
}
const form=$('#contact-form');
if(form)form.addEventListener('submit',async event=>{
  event.preventDefault(); if(!form.reportValidity())return;
  const button=form.querySelector('button[type="submit"]'),status=$('#contact-status');
  const isim=$('#contact-name').value.trim(),mesaj=$('#contact-message').value.trim();
  if(!isim||!mesaj){status.textContent='Lütfen adını ve mesajını yaz.';return;}
  button.disabled=true;button.textContent='Gönderiliyor…';status.textContent='';
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch('https://n8n.ilgininsani.com/webhook/ilgin-insani-iletisim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({isim,mesaj}),signal:controller.signal});
    if(!response.ok)throw new Error('Send failed');
    status.textContent='Mesajın iletildi. Ilgın’ın hikâyesine katkın için teşekkürler.';form.reset();
  } catch {status.textContent='Gönderim doğrulanamadı. Mesajın burada duruyor; tekrar deneyebilir veya Instagram’dan ulaşabilirsin.';}
  finally{clearTimeout(timeout);button.disabled=false;button.textContent='Mesajı gönder ↗';}
});
let installPrompt;
window.addEventListener('beforeinstallprompt',event=>{const button=$('#install');if(!button)return;event.preventDefault();installPrompt=event;button.hidden=false;});
$('#install')?.addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('#install').hidden=true;}});
window.addEventListener('appinstalled',()=>{if($('#install'))$('#install').hidden=true;});
if('serviceWorker' in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{});});
loadNews();loadWeather();loadPharmacy();

async function loadCityNews(){
 const grid=$('#official-news');if(!grid)return;
 try{const data=await getJSON('/api/news');if(!Array.isArray(data.articles)||!data.articles.length)return;
 const fragment=document.createDocumentFragment();
 for(const post of data.articles.slice(0,6)){
  if(!/^[a-f0-9]{20}$/.test(post.id))continue;
  const card=element('a',null,'news-card');card.href='/haber/'+post.id;
  const imageBox=element('div',null,'news-image');
  const img=element('img');img.src=/^\/media\/[a-f0-9]{20}\.webp$/.test(post.image)?post.image:'/ilgin-800.webp';img.alt=post.image?post.title:'Ilgın şehir panoraması';img.width=1000;img.height=750;img.loading='lazy';imageBox.append(img,element('span',post.category||'Ilgın','news-category'));
  const date=element('time',new Date(post.published+'T12:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'}));date.dateTime=post.published;
  card.append(imageBox,date,element('h3',post.title),element('span',post.source_name||'Ilgın İnsanı','source-link'));fragment.append(card);
 }
 if(fragment.childNodes.length)grid.replaceChildren(fragment);
 }catch{/* Curated source-linked cards remain available if the service is unavailable. */}
}
loadCityNews();

"""Ilgın newsroom: same-origin API, persistent SQLite and scheduled public-source import."""
import os, re, json, time, secrets, hashlib, sqlite3, threading, io
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
from functools import wraps
import requests
from bs4 import BeautifulSoup
from PIL import Image, UnidentifiedImageError
from flask import Flask, request, jsonify, abort, send_from_directory, make_response, render_template_string

ROOT=Path(__file__).parent.resolve()
DATA=Path(os.environ.get('DATA_DIR','/data'));DATA.mkdir(parents=True,exist_ok=True)
MEDIA=DATA/'media';MEDIA.mkdir(exist_ok=True)
ORIGIN=os.environ.get('PUBLIC_ORIGIN','https://ilgininsani.com').rstrip('/')
AUTH_URL='https://n8n.ilgininsani.com/webhook/dashboard-login'
SOURCE='https://www.ilgin.gov.tr/'
app=Flask(__name__,static_folder=None);app.config['MAX_CONTENT_LENGTH']=6*1024*1024
sync_lock=threading.Lock()

def db():
 c=sqlite3.connect(DATA/'news.sqlite',timeout=15);c.row_factory=sqlite3.Row;return c
with db() as c:
 c.executescript('''PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS articles(id TEXT PRIMARY KEY,title TEXT NOT NULL,summary TEXT NOT NULL DEFAULT '',body TEXT NOT NULL DEFAULT '',image TEXT NOT NULL DEFAULT '',source_url TEXT UNIQUE,source_name TEXT NOT NULL DEFAULT '',published TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'published',category TEXT NOT NULL DEFAULT 'Ilgın',edited INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at TEXT NOT NULL,action TEXT NOT NULL,article TEXT);
 CREATE TABLE IF NOT EXISTS attempts(at INTEGER NOT NULL);
 INSERT OR IGNORE INTO settings VALUES('auto_publish','true');''')

def now():return datetime.now(timezone.utc).isoformat()
def setting(key,default=''):
 with db() as c:
  r=c.execute('SELECT value FROM settings WHERE key=?',(key,)).fetchone();return r[0] if r else default
def put_setting(key,value):
 with db() as c:c.execute('INSERT OR REPLACE INTO settings VALUES(?,?)',(key,str(value)))
def audit(action,article=''):
 with db() as c:c.execute('INSERT INTO audit(at,action,article) VALUES(?,?,?)',(now(),action,article))
def secure_url(value,hosts=None):
 try:
  u=urlparse(value)
  return u.scheme=='https' and bool(u.hostname) and not u.username and not u.password and (hosts is None or u.hostname in hosts) and u.port in (None,443)
 except ValueError:return False

def source_get(url):
 if not secure_url(url,{'www.ilgin.gov.tr','ilgin.gov.tr'}):raise ValueError('Kaynak adresi kabul edilmedi')
 for _ in range(3):
  r=requests.get(url,timeout=(6,20),allow_redirects=False,stream=True,headers={'User-Agent':'IlginInsaniNews/1.0 (+https://ilgininsani.com)'})
  if r.is_redirect:
   url=urljoin(url,r.headers.get('Location',''));r.close()
   if not secure_url(url,{'www.ilgin.gov.tr','ilgin.gov.tr'}):raise ValueError('Kaynak yönlendirmesi kabul edilmedi')
   continue
  r.raise_for_status();chunks=[];size=0
  for chunk in r.iter_content(65536):
   size+=len(chunk)
   if size>6*1024*1024:r.close();raise ValueError('Dosya çok büyük')
   chunks.append(chunk)
  r.close();return b''.join(chunks)
 raise ValueError('Çok fazla yönlendirme')

def store_image(raw,key):
 Image.MAX_IMAGE_PIXELS=18000000
 with Image.open(io.BytesIO(raw)) as im:
  if im.width*im.height>18000000:raise ValueError('Görsel çok büyük')
  im=im.convert('RGB');im.thumbnail((1400,1100));im.save(MEDIA/(key+'.webp'),'WEBP',quality=82)
 return '/media/'+key+'.webp'

def collect_news():
 if not sync_lock.acquire(blocking=False):return {'busy':True}
 added=0;errors=0
 try:
  soup=BeautifulSoup(source_get(SOURCE),'html.parser')
  cards=soup.select('a.news-card-withDate')
  if not cards:raise ValueError('Kaynak sayfada haber bulunamadı')
  urls=list(dict.fromkeys(urljoin(SOURCE,a.get('href','')) for a in cards))[:16]
  for url in urls:
   with db() as c:
    if c.execute('SELECT 1 FROM articles WHERE source_url=?',(url,)).fetchone():continue
   try:
    page=BeautifulSoup(source_get(url),'html.parser');title_el=page.select_one('.page-title>span');body_el=page.select_one('.detail-content-container .icerik');date_el=page.select_one('.detail-content-container .card-date')
    if not title_el or not body_el or not date_el:raise ValueError('Haber biçimi tanınmadı')
    title=' '.join(title_el.stripped_strings)[:240];date=datetime.strptime(date_el.get_text(strip=True),'%d.%m.%Y').date().isoformat()
    # Source excerpts remain short, visibly attributed, and link to the full original.
    text=' '.join(body_el.stripped_strings);summary=' '.join(text.split()[:55])[:450]
    if len(text)>len(summary):summary=summary.rsplit(' ',1)[0]+'…'
    key=hashlib.sha256(url.encode()).hexdigest()[:20];img=body_el.select_one('img[src]');image=''
    if img:
     try:image=store_image(source_get(urljoin(url,img['src'])),key)
     except (ValueError,requests.RequestException,UnidentifiedImageError,OSError):errors+=1
    status='published' if setting('auto_publish')=='true' else 'draft'
    with db() as c:c.execute('INSERT OR IGNORE INTO articles(id,title,summary,image,source_url,source_name,published,status,created) VALUES(?,?,?,?,?,?,?,?,?)',(key,title,summary,image,url,'Ilgın Kaymakamlığı',date,status,now()))
    added+=1
   except (ValueError,requests.RequestException,OSError):errors+=1
  result={'at':now(),'added':added,'errors':errors,'ok':True};put_setting('last_sync',json.dumps(result));audit('source-sync');return result
 except Exception:
  result={'at':now(),'added':added,'errors':errors+1,'ok':False,'message':'Kaynağa erişilemedi; kayıtlı haberler korunuyor.'};put_setting('last_sync',json.dumps(result));return result
 finally:sync_lock.release()

def scheduler():
 while True:
  collect_news();time.sleep(3600)

@app.after_request
def headers(response):
 response.headers['X-Content-Type-Options']='nosniff';response.headers['Referrer-Policy']='strict-origin-when-cross-origin'
 if request.path.startswith(('/api/admin','/admin')):
  response.headers['Cache-Control']='no-store';response.headers['X-Frame-Options']='DENY'
 return response

def session_record():
 token=request.cookies.get('ilgin_admin','')
 if not token:return None
 with db() as c:return c.execute('SELECT * FROM sessions WHERE token=? AND expires>?',(hashlib.sha256(token.encode()).hexdigest(),int(time.time()))).fetchone()
def admin(fn):
 @wraps(fn)
 def wrapped(*args,**kwargs):
  record=session_record()
  if not record:return jsonify(error='Giriş yapmanız gerekiyor.'),401
  if request.method not in ('GET','HEAD'):
   if request.headers.get('Origin')!=ORIGIN or not secrets.compare_digest(request.headers.get('X-CSRF-Token',''),record['csrf']):return jsonify(error='İstek doğrulanamadı.'),403
  return fn(*args,**kwargs)
 return wrapped

@app.get('/api/health')
def health():
 with db() as c:c.execute('SELECT 1')
 return jsonify(ok=True)
@app.get('/api/news')
def news():
 with db() as c:rows=c.execute("SELECT id,title,summary,image,source_url,source_name,published,category FROM articles WHERE status='published' ORDER BY published DESC,created DESC LIMIT 36").fetchall()
 return jsonify(articles=[dict(r) for r in rows])
@app.post('/api/admin/login')
def login():
 if request.headers.get('Origin')!=ORIGIN:return jsonify(error='İstek doğrulanamadı.'),403
 stamp=int(time.time())
 with db() as c:
  c.execute('DELETE FROM attempts WHERE at<?',(stamp-900,))
  if c.execute('SELECT COUNT(*) FROM attempts').fetchone()[0]>=20:return jsonify(error='Çok fazla deneme. 15 dakika sonra tekrar deneyin.'),429
  c.execute('INSERT INTO attempts VALUES(?)',(stamp,))
 password=(request.get_json(silent=True) or {}).get('password','')
 if not isinstance(password,str) or not 1<=len(password)<=512:return jsonify(error='Geçersiz giriş.'),400
 try:
  r=requests.post(AUTH_URL,json={'password':password},timeout=12,allow_redirects=False)
  valid=r.status_code==200 and r.json().get('success') is True
 except (requests.RequestException,ValueError,AttributeError):return jsonify(error='Yönetici giriş servisine ulaşılamadı.'),503
 if not valid:return jsonify(error='Giriş bilgisi doğrulanamadı.'),401
 token=secrets.token_urlsafe(40);csrf=secrets.token_urlsafe(32)
 with db() as c:
  c.execute('DELETE FROM sessions WHERE expires<?',(stamp,));c.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),csrf,stamp+28800))
 response=jsonify(ok=True,csrf=csrf);response.set_cookie('ilgin_admin',token,max_age=28800,httponly=True,secure=ORIGIN.startswith('https:'),samesite='Strict',path='/api/admin');audit('login');return response
@app.get('/api/admin/session')
@admin
def session():return jsonify(ok=True,csrf=session_record()['csrf'])
@app.post('/api/admin/logout')
@admin
def logout():
 with db() as c:c.execute('DELETE FROM sessions WHERE token=?',(session_record()['token'],))
 response=jsonify(ok=True);response.delete_cookie('ilgin_admin',path='/api/admin');return response
@app.get('/api/admin/news')
@admin
def admin_news():
 with db() as c:rows=c.execute('SELECT * FROM articles ORDER BY published DESC,created DESC LIMIT 300').fetchall()
 return jsonify(articles=[dict(r) for r in rows],auto_publish=setting('auto_publish')=='true',last_sync=json.loads(setting('last_sync','{}')),syncing=sync_lock.locked())
@app.post('/api/admin/sync')
@admin
def sync():
 if sync_lock.locked():return jsonify(ok=True,busy=True),202
 threading.Thread(target=collect_news,daemon=True).start();return jsonify(ok=True),202
@app.post('/api/admin/settings')
@admin
def settings():
 payload=request.get_json(silent=True) or {}
 if not isinstance(payload.get('auto_publish'),bool):return jsonify(error='Geçersiz ayar.'),400
 put_setting('auto_publish','true' if payload['auto_publish'] else 'false');audit('settings');return jsonify(ok=True)
@app.post('/api/admin/news')
@admin
def save_news():
 data=request.get_json(silent=True) or {};key=data.get('id') or secrets.token_hex(10)
 if not re.fullmatch('[a-f0-9]{20}',key):return jsonify(error='Geçersiz haber.'),400
 limits={'title':240,'summary':600,'body':12000,'category':60,'image':200,'source_url':1500,'source_name':120,'published':10,'status':12}
 values={k:data.get(k,'') for k in limits}
 if any(not isinstance(v,str) or len(v)>limits[k] for k,v in values.items()):return jsonify(error='Alan uzunluğu veya biçimi geçersiz.'),400
 if not values['title'].strip() or values['status'] not in ('draft','published','archived'):return jsonify(error='Başlık ve yayın durumu gerekiyor.'),400
 try:datetime.strptime(values['published'],'%Y-%m-%d')
 except ValueError:return jsonify(error='Geçerli bir tarih girin.'),400
 if values['image'] and not re.fullmatch(r'/media/[a-f0-9]{20}\.webp',values['image']):return jsonify(error='Panelden yüklenmiş bir görsel seçin.'),400
 if values['source_url'] and not secure_url(values['source_url']):return jsonify(error='Kaynak HTTPS bağlantısı olmalı.'),400
 with db() as c:
  old=c.execute('SELECT * FROM articles WHERE id=?',(key,)).fetchone()
  if old and old['source_url'] and old['source_name']=='Ilgın Kaymakamlığı':values['source_url']=old['source_url'];values['source_name']=old['source_name']
  c.execute('''INSERT INTO articles(id,title,summary,body,image,source_url,source_name,published,status,category,edited,created) VALUES(?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,body=excluded.body,image=excluded.image,source_url=excluded.source_url,source_name=excluded.source_name,published=excluded.published,status=excluded.status,category=excluded.category,edited=1''',(key,values['title'].strip(),values['summary'],values['body'],values['image'],values['source_url'] or None,values['source_name'],values['published'],values['status'],values['category'],now()))
 audit('save',key);return jsonify(ok=True,id=key)
@app.post('/api/admin/image')
@admin
def upload():
 file=request.files.get('image')
 if not file:return jsonify(error='Görsel seçin.'),400
 try:path=store_image(file.read(),secrets.token_hex(10))
 except (ValueError,OSError,UnidentifiedImageError,Image.DecompressionBombError):return jsonify(error='Geçerli ve en fazla 18 megapiksel bir görsel seçin.'),400
 return jsonify(image=path)
@app.get('/media/<name>')
def media(name):
 if not re.fullmatch(r'[a-f0-9]{20}\.webp',name):abort(404)
 return send_from_directory(MEDIA,name,max_age=31536000)
@app.get('/haber/<key>')
def article(key):
 with db() as c:row=c.execute("SELECT * FROM articles WHERE id=? AND status='published'",(key,)).fetchone()
 if not row:abort(404)
 return render_template_string((ROOT/'article-template.html').read_text(),a=dict(row),origin=ORIGIN)
@app.get('/sitemap-news.xml')
def news_sitemap():
 with db() as c:rows=c.execute("SELECT id,published FROM articles WHERE status='published'").fetchall()
 xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<url><loc>{ORIGIN}/haber/{r["id"]}</loc><lastmod>{r["published"]}</lastmod></url>' for r in rows)+'</urlset>'
 return app.response_class(xml,mimetype='application/xml')
@app.get('/')
def home():return send_from_directory(ROOT,'index.html',max_age=0)
@app.get('/admin')
@app.get('/admin/')
def admin_page():return send_from_directory(ROOT,'admin.html',max_age=0)
@app.get('/reklam')
@app.get('/reklam/')
def ad_page():return send_from_directory(ROOT/'reklam','index.html',max_age=0)
@app.get('/<path:name>')
def static_file(name):
 if any(part.startswith('.') for part in Path(name).parts) or Path(name).suffix.lower() not in {'.html','.css','.js','.png','.jpg','.jpeg','.webp','.svg','.ico','.json','.xml','.txt','.woff2'} or name in {'article-template.html','requirements.txt'}:abort(404)
 if name.endswith('.json') and name!='manifest.json':abort(404)
 if name.endswith('.txt') and name not in {'robots.txt','THREE-LICENSE.txt'}:abort(404)
 if name.endswith(('.js','.css')) and 'gzip' in request.headers.get('Accept-Encoding','') and (ROOT/(name+'.gz')).exists():
  response=send_from_directory(ROOT,name+'.gz',mimetype='text/javascript' if name.endswith('.js') else 'text/css',max_age=86400);response.headers['Content-Encoding']='gzip';response.headers['Vary']='Accept-Encoding';return response
 return send_from_directory(ROOT,name,max_age=0 if name.endswith(('.html','.js','.css','.xml')) else 86400)

if os.environ.get('NEWS_SCHEDULER','1')=='1':threading.Thread(target=scheduler,daemon=True).start()
if __name__=='__main__':app.run(host='127.0.0.1',port=int(os.environ.get('PORT','8766')))

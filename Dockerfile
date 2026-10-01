FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATA_DIR=/data
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home newsroom && mkdir /data && chown newsroom:newsroom /data
COPY . .
RUN python -c "import gzip,pathlib; [(p.with_name(p.name+'.gz').write_bytes(gzip.compress(p.read_bytes(),compresslevel=9))) for p in pathlib.Path('.').glob('*') if p.suffix in ('.js','.css')]"
USER newsroom
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health',timeout=3)"
CMD ["gunicorn","--bind","0.0.0.0:8080","--workers","1","--threads","4","--timeout","60","--access-logfile","-","server:app"]

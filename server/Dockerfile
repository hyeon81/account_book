FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt /tmp/server-requirements.txt
RUN python -m pip install --no-cache-dir -r /tmp/server-requirements.txt
COPY server/src/account_book_server /usr/local/lib/python3.12/site-packages/account_book_server
ENV PYTHONDONTWRITEBYTECODE=1 API_HOST=0.0.0.0
USER nobody
EXPOSE 8000
CMD ["sh", "-c", "python -m account_book_server.migrate && exec python -m account_book_server.main"]

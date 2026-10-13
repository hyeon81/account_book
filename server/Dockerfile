FROM python:3.12-slim
WORKDIR /app
COPY server/src/account_book_server /usr/local/lib/python3.12/site-packages/account_book_server
ENV PYTHONDONTWRITEBYTECODE=1 API_HOST=0.0.0.0
USER nobody
EXPOSE 8000
CMD ["python", "-m", "account_book_server.main"]

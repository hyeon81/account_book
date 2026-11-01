FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
ENV PYTHONPATH=/app/src PYTHONDONTWRITEBYTECODE=1
USER 10001:10001
EXPOSE 8001
CMD ["python", "-m", "account_book_agent.bootstrap"]

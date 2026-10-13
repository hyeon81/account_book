FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig*.json vite.config.ts .oxlintrc.json .gitignore ./
COPY src ./src
COPY tests ./tests
RUN npm run build \
    && mkdir -p node_modules/.vite-temp \
    && chown node:node node_modules/.vite-temp

USER node
EXPOSE 8080
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "8080", "--strictPort"]

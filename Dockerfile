FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app

# Chromium is required for HTML-to-PDF agreement generation.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fontconfig \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Keep dev dependencies available because runtime startup uses Prisma CLI.
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 10000

CMD ["npm", "run", "docker-start"]

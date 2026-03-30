FROM node:20-bookworm-slim

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

# Keep dev dependencies available because the Vite build and Prisma CLI both
# need packages from devDependencies during image build/runtime startup.
RUN npm ci --include=dev

COPY . .

RUN npm run build

EXPOSE 10000

ENV NODE_ENV=production

CMD ["npm", "run", "docker-start"]

FROM node:22-alpine
RUN apk add --no-cache curl openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY src ./src
CMD ["npm","start"]

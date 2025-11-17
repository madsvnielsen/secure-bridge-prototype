FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
RUN mkdir /nginx_error.log
COPY src ./src
EXPOSE 8080
CMD ["npm","start"]

FROM php:8.3-cli

# --- Install system deps for Composer + OpenSSL CA tools ---
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    openssl \
 && docker-php-ext-install zip \
 && rm -rf /var/lib/apt/lists/*

# --- Install Composer ---
RUN php -r "copy('https://getcomposer.org/installer','composer-setup.php');" \
 && php composer-setup.php --install-dir=/usr/local/bin --filename=composer \
 && rm composer-setup.php

WORKDIR /app

COPY . /app

RUN composer require phpseclib/phpseclib:^3.0 --no-interaction --prefer-dist \
 && composer install --no-interaction --prefer-dist

RUN cp .env.example .env \
 && php artisan key:generate

RUN mkdir -p /app/database \
 && touch /app/database/database.sqlite \
 && sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=sqlite/' .env \
 && sed -i 's|^DB_DATABASE=.*|DB_DATABASE=/app/database/database.sqlite|' .env \
 && sed -i 's/^SESSION_DRIVER=.*/SESSION_DRIVER=database/' .env \
 && php artisan migrate --force

RUN mkdir -p /app/certs/ca/newcerts /app/certs/ca/crl \
 && touch /app/certs/ca/index.txt \
 && if [ ! -f /app/certs/ca/serial ]; then echo "1000" > /app/certs/ca/serial; fi \
 && if [ ! -f /app/certs/ca/crlnumber ]; then echo "1" > /app/certs/ca/crlnumber; fi

RUN php artisan ca:crl:init

EXPOSE 8000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]

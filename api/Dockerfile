FROM php:8.3-cli

# --- Install system deps for Composer (git, unzip, zip extension) ---
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
 && docker-php-ext-install zip \
 && rm -rf /var/lib/apt/lists/*

# --- Install Composer ---
RUN php -r "copy('https://getcomposer.org/installer','composer-setup.php');" \
 && php composer-setup.php --install-dir=/usr/local/bin --filename=composer \
 && rm composer-setup.php

WORKDIR /app

# --- Copy full app, including artisan ---
COPY . /app

# --- Install dependencies ---
RUN composer install --no-interaction --prefer-dist

# --- Create .env and generate key ---
RUN cp .env.example .env \
 && php artisan key:generate

# --- Configure SQLite database and run migrations ---
RUN mkdir -p /app/database \
 && touch /app/database/database.sqlite \
 && sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=sqlite/' .env \
 && sed -i 's|^DB_DATABASE=.*|DB_DATABASE=/app/database/database.sqlite|' .env \
 && sed -i 's/^SESSION_DRIVER=.*/SESSION_DRIVER=database/' .env \
 && php artisan migrate --force

EXPOSE 8000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]

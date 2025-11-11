FROM php:8.3-cli

# Install Composer
RUN php -r "copy('https://getcomposer.org/installer','composer-setup.php');" \
 && php composer-setup.php --install-dir=/usr/local/bin --filename=composer \
 && rm composer-setup.php

WORKDIR /app
COPY . /app

# Install deps (adjust as needed)
RUN composer install --no-interaction --prefer-dist

EXPOSE 8000
CMD ["php","artisan","serve","--host=0.0.0.0","--port=8000"]

FROM php:8.3-cli
WORKDIR /app
RUN apt-get update && apt-get install -y unzip git libzip-dev && docker-php-ext-install zip
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY . /app
RUN composer install --no-interaction
RUN php artisan key:generate
EXPOSE 8000
CMD ["php","-S","0.0.0.0:8000","-t","public"]

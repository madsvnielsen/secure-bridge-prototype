@echo off
setlocal

set "OPENSSL=C:\Program Files\Git\usr\bin\openssl.exe"

set "CERT_DIR=api\certs"
set "CA_DIR=%CERT_DIR%\ca"
set "API_DIR=%CERT_DIR%\api"
set "WS_DIR=%CERT_DIR%\ws"

echo.
echo ==^> Using OpenSSL at: %OPENSSL%
echo ==^> Cert root: %CERT_DIR%
echo.

if not exist "%CA_DIR%" mkdir "%CA_DIR%"
if not exist "%API_DIR%" mkdir "%API_DIR%"
if not exist "%WS_DIR%" mkdir "%WS_DIR%"

REM === 1) CA key + cert ===
echo ==^> Generating CA key + cert (if not existing)...

if not exist "%CA_DIR%\ca.key" (
  echo    - Creating ca.key ...
  "%OPENSSL%" genrsa -out "%CA_DIR%\ca.key" 4096
) else (
  echo    - ca.key already exists, skipping
)

if not exist "%CA_DIR%\ca.crt" (
  echo    - Creating ca.crt ...
  "%OPENSSL%" req -x509 -new -nodes ^
    -key "%CA_DIR%\ca.key" ^
    -sha256 -days 3650 ^
    -out "%CA_DIR%\ca.crt" ^
    -subj "/CN=Hococo-Internal-CA"
) else (
  echo    - ca.crt already exists, skipping
)

REM === 2) API server cert ===
echo.
echo ==^> Generating API server key + CSR + cert ...

echo    - Creating api.key ...
"%OPENSSL%" genrsa -out "%API_DIR%\api.key" 2048

echo    - Creating api.csr with CN=api.hococo.internal ...
"%OPENSSL%" req -new ^
  -key "%API_DIR%\api.key" ^
  -out "%API_DIR%\api.csr" ^
  -subj "/CN=api.hococo.internal"

echo    - Writing api.ext (SAN config for API server) ...
(
  echo authorityKeyIdentifier=keyid,issuer
  echo basicConstraints=CA:FALSE
  echo keyUsage = digitalSignature, keyEncipherment
  echo extendedKeyUsage = serverAuth
  echo subjectAltName = @alt_names
  echo.
  echo [alt_names]
  echo DNS.1 = api.hococo.internal
  echo DNS.2 = api
  echo DNS.3 = localhost
) > "%API_DIR%\api.ext"

echo    - Signing api.csr with CA ...
"%OPENSSL%" x509 -req ^
  -in "%API_DIR%\api.csr" ^
  -CA "%CA_DIR%\ca.crt" ^
  -CAkey "%CA_DIR%\ca.key" ^
  -CAcreateserial ^
  -out "%API_DIR%\api.crt" ^
  -days 365 ^
  -sha256 ^
  -extfile "%API_DIR%\api.ext"

echo ==^> Generating API CLIENT key + CSR + cert  ...

echo    - Creating api-client.key ...
"%OPENSSL%" genrsa -out "%API_DIR%\api-client.key" 2048

echo    - Creating api-client.csr with CN=Hococo-API-Client ...
"%OPENSSL%" req -new ^
  -key "%API_DIR%\api-client.key" ^
  -out "%API_DIR%\api-client.csr" ^
  -subj "/CN=Hococo-API-Client"

echo    - Writing api-client.ext ...
(
  echo authorityKeyIdentifier=keyid,issuer
  echo basicConstraints=CA:FALSE
  echo keyUsage = digitalSignature, keyEncipherment
  echo extendedKeyUsage = clientAuth
  echo subjectAltName = @alt_names
  echo.
  echo [alt_names]
  echo DNS.1 = api.hococo.internal
  echo DNS.2 = api
  echo DNS.3 = localhost
) > "%API_DIR%\api-client.ext"

echo    - Signing api-client.csr with CA ...
"%OPENSSL%" x509 -req ^
  -in "%API_DIR%\api-client.csr" ^
  -CA "%CA_DIR%\ca.crt" ^
  -CAkey "%CA_DIR%\ca.key" ^
  -CAcreateserial ^
  -out "%API_DIR%\api-client.crt" ^
  -days 365 ^
  -sha256 ^
  -extfile "%API_DIR%\api-client.ext"

echo.
echo ==^> Generating WS server key + CSR + cert ...

echo    - Creating ws.key ...
"%OPENSSL%" genrsa -out "%WS_DIR%\ws.key" 2048

echo    - Creating ws.csr with CN=ws.hococo.internal ...
"%OPENSSL%" req -new ^
  -key "%WS_DIR%\ws.key" ^
  -out "%WS_DIR%\ws.csr" ^
  -subj "/CN=ws.hococo.internal"

echo    - Writing ws.ext ...
(
  echo authorityKeyIdentifier=keyid,issuer
  echo basicConstraints=CA:FALSE
  echo keyUsage = digitalSignature, keyEncipherment
  echo extendedKeyUsage = serverAuth
  echo subjectAltName = @alt_names
  echo.
  echo [alt_names]
  echo DNS.1 = ws.hococo.internal
  echo DNS.2 = ws
  echo DNS.3 = localhost
) > "%WS_DIR%\ws.ext"

echo    - Signing ws.csr with CA ...
"%OPENSSL%" x509 -req ^
  -in "%WS_DIR%\ws.csr" ^
  -CA "%CA_DIR%\ca.crt" ^
  -CAkey "%CA_DIR%\ca.key" ^
  -CAcreateserial ^
  -out "%WS_DIR%\ws.crt" ^
  -days 365 ^
  -sha256 ^
  -extfile "%WS_DIR%\ws.ext"

echo.
echo ==^> Done.
echo    CA:         %CA_DIR%\ca.crt
echo    API server: %API_DIR%\api.crt        + %API_DIR%\api.key
echo    API client: %API_DIR%\api-client.crt + %API_DIR%\api-client.key
echo    WSS server: %WS_DIR%\ws.crt          + %WS_DIR%\ws.key

endlocal
exit /b 0

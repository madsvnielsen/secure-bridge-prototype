<?php

namespace App\Services;

use RuntimeException;

class BridgeCertificateIssuer
{
    public function issue(string $csrPem, string $bridgeConfigurationId): array
    {
        $caCertPath = env('CA_CERT_PATH', '/app/certs/ca/ca.crt');
        $caKeyPath  = env('CA_KEY_PATH',  '/app/certs/ca/ca.key');
        $validDays  = (int) env('BRIDGE_CERT_VALID_DAYS', 365);

        $caCertPem = @file_get_contents($caCertPath);
        $caKeyPem  = @file_get_contents($caKeyPath);

        if ($caCertPem === false || $caKeyPem === false) {
            throw new RuntimeException("CA certificate or key not found (paths: $caCertPath, $caKeyPath)");
        }

        $caCert = openssl_x509_read($caCertPem);
        $caKey  = openssl_pkey_get_private($caKeyPem);

        if ($caCert === false || $caKey === false) {
            throw new RuntimeException('Failed to load CA certificate or key');
        }

        $csrSubject = openssl_csr_get_subject($csrPem);
        if ($csrSubject === false) {
            throw new RuntimeException('CSR is invalid or could not be parsed');
        }

        $configPath = tempnam(sys_get_temp_dir(), 'openssl_cnf_');
        $sanUri = "URI:bridge:$bridgeConfigurationId";

        $configContent = <<<CONF
[ req ]
distinguished_name = req_distinguished_name

[ req_distinguished_name ]

[ v3_req ]
subjectAltName = @alt_names
keyUsage = critical, digitalSignature, keyAgreement
extendedKeyUsage = clientAuth

[ alt_names ]
URI.1 = $sanUri
CONF;

        file_put_contents($configPath, $configContent);

        $serial = random_int(1, PHP_INT_MAX);

        $cert = openssl_csr_sign(
            $csrPem,
            $caCert,
            $caKey,
            $validDays,
            [
                'digest_alg'      => 'sha256',
                'config'          => $configPath,
                'x509_extensions' => 'v3_req',
            ],
            $serial
        );

        unlink($configPath);

        if ($cert === false) {
            throw new RuntimeException('Failed to sign certificate');
        }

        $deviceCertPem = '';
        openssl_x509_export($cert, $deviceCertPem);

        $deviceCertChainPem = $deviceCertPem . "\n" . $caCertPem;

        return [
            'deviceCertificateChainPem' => $deviceCertChainPem,
            'caBundlePem'               => $caCertPem,
        ];
    }
}

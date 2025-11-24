<?php

namespace App\Services;

use App\Models\BridgeConfiguration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use phpseclib3\File\X509;
use phpseclib3\Crypt\PublicKeyLoader;
use phpseclib3\Math\BigInteger;


class CertificateAuthority
{
    /**
     * CSR validation.
     */
    public function validateBridgeCsr(string $csrPem): void
    {
        $csrSubject = openssl_csr_get_subject($csrPem);
        $csrPubKey  = openssl_csr_get_public_key($csrPem);

        if ($csrSubject === false || $csrPubKey === false) {
            throw new RuntimeException('CSR could not be parsed or is invalid.');
        }

        openssl_free_key($csrPubKey);
    }

    /**
     * Issue a bridge client certificate from a CSR.
     */
    public function issueBridgeCertificate(string $csrPem, string $bridgeConfigurationId): array
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

        // Temporary OpenSSL config to add SAN + key usages
        $configPath = tempnam(sys_get_temp_dir(), 'openssl_cnf_');
        $sanUri     = "URI:bridge:$bridgeConfigurationId";

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
            "certSerial"                  => $serial  
        ];
    }

    /**
     * Validate the mTLS client cert for a given bridgeConfigurationId and
     * return the RFC 8705 x5t#S256 thumbprint.
     */
    public function getBridgeCertThumbprintFromRequest(Request $request, string $bridgeConfigurationId): string
    {
        $escapedCert = $request->header('ssl-client-cert');

        if (! $escapedCert) {
            throw new RuntimeException('Client certificate header (ssl-client-cert) is missing.');
        }

        // nginx $ssl_client_escaped_cert is percent-encoded PEM
        $pem = urldecode($escapedCert);

        if (strpos($pem, '-----BEGIN CERTIFICATE-----') === false) {
            $pem = "-----BEGIN CERTIFICATE-----\n" . trim($pem) . "\n-----END CERTIFICATE-----\n";
        }

        $certRes = @openssl_x509_read($pem);
        if ($certRes === false) {
            throw new RuntimeException('Client certificate could not be parsed.');
        }

        $certData = @openssl_x509_parse($certRes);
        if ($certData === false) {
            openssl_x509_free($certRes);
            throw new RuntimeException('Client certificate could not be parsed.');
        }

        // Lifetime
        $now       = time();
        $notBefore = $certData['validFrom_time_t'] ?? null;
        $notAfter  = $certData['validTo_time_t'] ?? null;

        if ($notBefore === null || $notAfter === null || $now < $notBefore || $now > $notAfter) {
            openssl_x509_free($certRes);
            throw new RuntimeException('Client certificate is expired or not yet valid.');
        }

        // SAN binding
        $san = $certData['extensions']['subjectAltName'] ?? '';

        if (strpos($san, "bridge:{$bridgeConfigurationId}") === false) {
            openssl_x509_free($certRes);
            throw new RuntimeException('Client certificate is not bound to this bridge configuration.');
        }

        openssl_x509_free($certRes);

        // Compute RFC 8705 x5t#S256
        $base64 = preg_replace(
            '~-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+~',
            '',
            $pem
        );
        $der = base64_decode($base64, true);

        if ($der === false) {
            throw new RuntimeException('Could not decode certificate DER bytes.');
        }

        $sha256Raw = hash('sha256', $der, true);

        $x5tS256 = rtrim(strtr(base64_encode($sha256Raw), '+/', '-_'), '=');

        return $x5tS256;
    }
    
    public function getCrlPemPath(): string
    {
        return env('BRIDGE_CRL_PATH', '/var/lib/hococo-crl/bridge.crl.pem');
    }

    /**
     * Mark a certificate as revoked in the DB and regenerate CRL.
     */
    public function revokeBridgeCertificateBySerial(string $serial): void
    {
        BridgeConfiguration::where('cert_serial', $serial)->update([
            'revoked_at' => now(),
        ]);

        // Rebuild CRL
        $this->generateX509CrlFromDb();
    }

    /**
     * Build a X.509 CRL from all revoked bridge cert serials in DB.
     */
    public function generateX509CrlFromDb(): void
    {
        $caCertPath = env('CA_CERT_PATH', '/app/certs/ca/ca.crt');
        $caKeyPath  = env('CA_KEY_PATH',  '/app/certs/ca/ca.key');
        $pemPath    = $this->getCrlPemPath();

        $caCertPem = @file_get_contents($caCertPath);
        $caKeyPem  = @file_get_contents($caKeyPath);

        if ($caCertPem === false || $caKeyPem === false) {
            throw new RuntimeException("CA certificate or key not found (paths: $caCertPath, $caKeyPath)");
        }

        $issuer = new X509();
        $issuer->loadX509($caCertPem);
        $issuer->setPrivateKey(PublicKeyLoader::loadPrivateKey($caKeyPem));

        $crl   = new X509();
        $empty = new X509(); 

        $baseCrl = $crl->signCRL($issuer, $empty);
        $crl->loadCRL($crl->saveCRL($baseCrl));

        $crl->setStartDate('now');
        $crl->setEndDate('+365 days');

        $rows = BridgeConfiguration::whereNotNull('revoked_at')
            ->whereNotNull('cert_serial')
            ->get(['cert_serial']);

        foreach ($rows as $row) {
            $serial = trim((string) $row->cert_serial);
            if ($serial === '') {
                continue;
            }

            $crl->setRevokedCertificateExtension(
                $serial,
                'id-ce-cRLReasons',
                'unspecified'
            );
        }

        $signed = $crl->signCRL($issuer, $crl);
        $pem    = $crl->saveCRL($signed);

        if ($pem === false) {
            throw new RuntimeException('Failed to encode CRL to PEM.');
        }

        $dir = dirname($pemPath);
        if (! is_dir($dir)) {
            if (! mkdir($dir, 0775, true) && ! is_dir($dir)) {
                throw new RuntimeException("Failed to create CRL directory: {$dir}");
            }
        }

        if (file_put_contents($pemPath, $pem, LOCK_EX) === false) {
            throw new RuntimeException("Failed to write X.509 CRL PEM to {$pemPath}");
        }
    }
}
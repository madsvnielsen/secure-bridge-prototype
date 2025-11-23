<?php

namespace App\Services;

use Illuminate\Support\Str;
use RuntimeException;
use Illuminate\Http\Request;
use App\Services\CertificateAuthority;


class AuthorizationAuthority
{

    public function __construct(
        private CertificateAuthority $certificateAuthority,
    ) {}

    /**
     * Issue a short-lived bridge access token bound to the given cert thumbprint.
     *
     * @return array { accessToken, tokenType, expiresIn, scope }
     */
    public function issueBridgeToken(string $bridgeConfigurationId, string $certThumbprintX5tS256): array
    {
        $secret = config('app.bridge_token_secret', env('BRIDGE_TOKEN_SECRET'));

        if (empty($secret)) {
            throw new RuntimeException('BRIDGE_TOKEN_SECRET not configured');
        }

        $ttlSeconds = 600; // 10 minutes
        $nowTs      = now()->timestamp;
        $exp        = $nowTs + $ttlSeconds;

        $scope = 'bridge:ws bridge:results';

        $header = [
            'alg' => 'HS256',
            'typ' => 'JWT',
        ];

        $payload = [
            'iss'  => config('app.url', 'https://api.hococo.internal'),
            'sub'  => $bridgeConfigurationId,
            'aud'  => 'hococo.bridge',
            'iat'  => $nowTs,
            'nbf'  => $nowTs,
            'exp'  => $exp,
            'jti'  => (string) Str::uuid(),
            'scope' => $scope,
            'bridgeConfigurationId' => $bridgeConfigurationId,
            'cnf' => [
                'x5t#S256' => $certThumbprintX5tS256,
            ],
        ];

        $base64UrlEncode = function ($data) {
            return rtrim(
                strtr(
                    base64_encode(json_encode($data, JSON_UNESCAPED_SLASHES)),
                    '+/',
                    '-_'
                ),
                '='
            );
        };

        $headerEncoded  = $base64UrlEncode($header);
        $payloadEncoded = $base64UrlEncode($payload);
        $signingInput   = $headerEncoded . '.' . $payloadEncoded;

        $signature        = hash_hmac('sha256', $signingInput, $secret, true);
        $signatureEncoded = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');

        $jwt = $signingInput . '.' . $signatureEncoded;

        return [
            'accessToken' => $jwt,
            'tokenType'   => 'Bearer',
            'expiresIn'   => $ttlSeconds,
            'scope'       => $scope,
        ];
    }

    private function base64UrlDecode(string $input): string
    {
        $remainder = strlen($input) % 4;
        if ($remainder) {
            $input .= str_repeat('=', 4 - $remainder);
        }

        $input = strtr($input, '-_', '+/');

        $decoded = base64_decode($input, true);
        if ($decoded === false) {
            throw new RuntimeException('Invalid base64url encoding');
        }

        return $decoded;
    }

    public function verifyBridgeToken(
        string $jwt,
        string $expectedBridgeConfigurationId,
        string $expectedThumbprintX5tS256,
        string $requiredScope
    ): array {
        $secret = config('app.bridge_token_secret', env('BRIDGE_TOKEN_SECRET'));

        if (empty($secret)) {
            throw new RuntimeException('BRIDGE_TOKEN_SECRET not configured');
        }

        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            throw new RuntimeException('Invalid JWT format');
        }

        [$headerB64, $payloadB64, $sigB64] = $parts;

        $headerJson  = $this->base64UrlDecode($headerB64);
        $payloadJson = $this->base64UrlDecode($payloadB64);
        $sigRaw      = $this->base64UrlDecode($sigB64);

        $header  = json_decode($headerJson, true);
        $payload = json_decode($payloadJson, true);

        if (!is_array($header) || !is_array($payload)) {
            throw new RuntimeException('Invalid JWT JSON');
        }

        if (($header['alg'] ?? null) !== 'HS256') {
            throw new RuntimeException('Unsupported JWT alg');
        }

        // Verify signature
        $signingInput = $headerB64 . '.' . $payloadB64;
        $expectedSigRaw = hash_hmac('sha256', $signingInput, $secret, true);

        if (!hash_equals($expectedSigRaw, $sigRaw)) {
            throw new RuntimeException('Invalid JWT signature');
        }

        // Time checks
        $now = time();
        $exp = $payload['exp'] ?? null;
        $nbf = $payload['nbf'] ?? null;

        if (!is_int($exp) || !is_int($nbf)) {
            throw new RuntimeException('Invalid exp/nbf in token');
        }

        if ($now < $nbf || $now > $exp) {
            throw new RuntimeException('Token is expired or not yet valid');
        }

        // Audience,  subject, bridge ID binding
        if (($payload['aud'] ?? null) !== 'hococo.bridge') {
            throw new RuntimeException('Invalid token audience');
        }

        if (($payload['sub'] ?? null) !== $expectedBridgeConfigurationId) {
            throw new RuntimeException('Token subject does not match bridge configuration');
        }

        if (($payload['bridgeConfigurationId'] ?? null) !== $expectedBridgeConfigurationId) {
            throw new RuntimeException('Token bridgeConfigurationId mismatch');
        }

        // Cert binding check
        $cnf = $payload['cnf'] ?? [];
        $tokenThumb = $cnf['x5t#S256'] ?? null;

        if ($tokenThumb !== $expectedThumbprintX5tS256) {
            throw new RuntimeException('Token is not bound to this client certificate');
        }

        // Scope check
        $scopeStr = $payload['scope'] ?? '';
        $scopes   = preg_split('/\s+/', trim($scopeStr)) ?: [];

        if (!in_array($requiredScope, $scopes, true)) {
            throw new RuntimeException('Token does not have required scope: ' . $requiredScope);
        }

        return $payload;
    }

    public function authorizeBridgeRequest(
        Request $request,
        string $bridgeConfigurationId,
        string $requiredScope
    ): array {
        $authHeader = $request->header('Authorization');

        if (!$authHeader || !preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
            throw new RuntimeException('Missing or invalid Authorization header');
        }

        $jwt = $m[1];

        $thumb = $this->certificateAuthority
            ->getBridgeCertThumbprintFromRequest($request, $bridgeConfigurationId);

        $payload = $this->verifyBridgeToken(
            $jwt,
            $bridgeConfigurationId,
            $thumb,
            $requiredScope
        );

        return $payload; 
    }


}
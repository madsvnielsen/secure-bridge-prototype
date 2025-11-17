<?php

namespace App\Services;

use Illuminate\Support\Str;
use RuntimeException;

class AuthorizationAuthority
{
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

        $scope = 'bridge:ws bridge:events';

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
}

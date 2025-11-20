<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\CertificateAuthority;

class GenerateCrl extends Command
{
    protected $signature = 'ca:crl:init';
    protected $description = 'Generate an empty CRL if none exists';

    public function handle()
    {
        /** @var CertificateAuthority $ca */
        $ca = app(CertificateAuthority::class);

        if (!file_exists($ca->getCrlPemPath())) {
            $this->info("CRL not found. Creating new empty CRL...");
            $ca->generateX509CrlFromDb(); 
        } else {
            $this->info("CRL already exists.");
        }

        return Command::SUCCESS;
    }
}

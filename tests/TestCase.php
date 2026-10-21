<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $testingStorageRoot = base_path('storage/framework/testing');
        $isolatedStoragePath = $testingStorageRoot.'/xrlab-'.Str::uuid();

        if (! is_dir($isolatedStoragePath)
            && ! mkdir($isolatedStoragePath, 0700, true)
            && ! is_dir($isolatedStoragePath)) {
            throw new \RuntimeException('No se pudo crear el almacenamiento aislado de pruebas.');
        }

        $this->app->useStoragePath($isolatedStoragePath);
    }
}

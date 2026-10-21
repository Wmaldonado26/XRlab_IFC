<?php

$basePath = dirname(__DIR__);
$testingStorageRoot = $basePath.DIRECTORY_SEPARATOR.'storage'.DIRECTORY_SEPARATOR.'framework'.DIRECTORY_SEPARATOR.'testing';
$rootBeforeRun = realpath($testingStorageRoot);

if ($rootBeforeRun === false) {
    fwrite(STDERR, "No existe el directorio de almacenamiento de pruebas.\n");
    exit(1);
}

$existingPaths = array_fill_keys(glob($rootBeforeRun.DIRECTORY_SEPARATOR.'xrlab-*', GLOB_ONLYDIR) ?: [], true);
$process = proc_open(
    [PHP_BINARY, $basePath.DIRECTORY_SEPARATOR.'artisan', 'test'],
    [
        0 => ['file', 'php://stdin', 'r'],
        1 => ['file', 'php://stdout', 'w'],
        2 => ['file', 'php://stderr', 'w'],
    ],
    $pipes,
    $basePath,
    null,
    ['bypass_shell' => true],
);

if (! is_resource($process)) {
    fwrite(STDERR, "No se pudo iniciar PHPUnit.\n");
    exit(1);
}

$exitCode = proc_close($process);

try {
    $rootPrefix = rtrim($rootBeforeRun, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR;
    foreach (glob($rootPrefix.'xrlab-*', GLOB_ONLYDIR) ?: [] as $path) {
        if (isset($existingPaths[$path])) {
            continue;
        }

        $resolvedPath = realpath($path);
        if ($resolvedPath === false
            || ! str_starts_with(strtolower($resolvedPath), strtolower($rootPrefix))
            || is_link($path)
            || ! preg_match('/^xrlab-[0-9a-f-]{36}$/i', basename($resolvedPath))) {
            throw new RuntimeException("Se rechazó la limpieza de una ruta no reconocida: {$path}");
        }

        deleteDirectoryTree($resolvedPath);
    }
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage()."\n");
    $exitCode = 1;
}

exit($exitCode);

function deleteDirectoryTree(string $directory): void
{
    $entries = scandir($directory);
    if ($entries === false) {
        throw new RuntimeException("No se pudo inspeccionar el almacenamiento de pruebas: {$directory}");
    }

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        $entryPath = $directory.DIRECTORY_SEPARATOR.$entry;
        if (is_link($entryPath)) {
            throw new RuntimeException("Se rechazó la limpieza de un enlace simbólico: {$entryPath}");
        }

        if (is_dir($entryPath)) {
            deleteDirectoryTree($entryPath);
        } elseif (! unlink($entryPath)) {
            throw new RuntimeException("No se pudo eliminar un archivo de prueba: {$entryPath}");
        }
    }

    if (! rmdir($directory)) {
        throw new RuntimeException("No se pudo eliminar el directorio de prueba: {$directory}");
    }
}

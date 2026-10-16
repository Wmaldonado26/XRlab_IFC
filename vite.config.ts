import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import os from 'os';

function getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIp = process.env.VITE_DEV_HOST || getLocalIp();

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.ts',
            ],
            refresh: true,
        }),
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: (tag) => tag.startsWith('bim-'),
                },
            },
        }),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
        },
    },
    worker: {
        format: 'es',
    },
    optimizeDeps: {
        include: [
            '@thatopen/components',
            '@thatopen/components-front',
            '@thatopen/fragments',
            '@thatopen/ui',
            '@thatopen/ui-obc',
            'three',
            'web-ifc',
        ],
    },
    server: {
        host: '0.0.0.0',
        cors: true,
        origin: `http://${localIp}:5173`,
        hmr: {
            host: localIp,
        },
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});

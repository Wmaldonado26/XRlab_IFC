import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as FRAGS from '@thatopen/fragments';
import * as WEBIFC from 'web-ifc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Monkey-patch Web-IFC settings to eliminate artificial 2GB limit in Node.js
const ifcApiProto = WEBIFC.IfcAPI.prototype;
const originalCreateSettings = ifcApiProto?.CreateSettings;
if (originalCreateSettings) {
  ifcApiProto.CreateSettings = function (settings) {
    const s = originalCreateSettings.call(this, settings);
    s.MEMORY_LIMIT = settings?.MEMORY_LIMIT ?? 4294901760;
    return s;
  };
}

// Maximum safe file size for single-pass WebAssembly 32-bit linear memory (~1.75 GB)
const MAX_SAFE_WASM_SIZE = 1.75 * 1024 * 1024 * 1024;
// 2. Parse command-line arguments
const cleanArgs = process.argv.slice(2);

if (cleanArgs.length === 0 || cleanArgs.includes('--help') || cleanArgs.includes('-h')) {
  console.log(`
===================================================================
 BIM ThatOpen Engine: High-Capacity IFC -> FRAG Converter
===================================================================
 Usage:
   npm run convert -- <path-to-ifc-file> [optional-output-path.frag]

 Examples:
   npm run convert -- ./modelo.ifc
   npm run convert -- "C:/Proyectos/IFC_Entire_Ship_wo_ref_2026-07-16.ifc"
   npm run convert -- ./modelo.ifc ./public/models/modelo.frag

 This converter writes one .frag file and refuses inputs above the
 configured WebAssembly memory safety threshold. It never partitions IFCs.
===================================================================
`);
  process.exit(0);
}

const inputPath = path.resolve(process.cwd(), cleanArgs[0]);
let outputPath = cleanArgs[1]
  ? path.resolve(process.cwd(), cleanArgs[1])
  : inputPath.replace(/\.ifc$/i, '') + '.frag';

// 3. Verify input file exists
if (!fs.existsSync(inputPath)) {
  console.error(`\n❌ ERROR: Source IFC file not found:\n   ${inputPath}`);
  process.exit(1);
}

const stats = fs.statSync(inputPath);
if (!stats.isFile()) {
  console.error(`\n❌ ERROR: Specified path is not a file:\n   ${inputPath}`);
  process.exit(1);
}

const fileSizeBytes = stats.size;
const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
const fileSizeGB = (fileSizeBytes / (1024 * 1024 * 1024)).toFixed(2);

// ===================================================================
// SINGLE FILE CONVERSION (Worker Process or Files <= 1.75 GB)
// ===================================================================
async function convertSingleIfc(srcPath, dstPath) {
  const partStats = fs.statSync(srcPath);
  const partBytes = partStats.size;
  const partMB = (partBytes / (1024 * 1024)).toFixed(1);

  console.log('\n===================================================================');
  console.log(` 🚀 CONVERTING: ${path.basename(srcPath)} (${partMB} MB)`);
  console.log('===================================================================');
  console.log(` 📂 Source : ${srcPath}`);
  console.log(` 💾 Target : ${dstPath}`);
  console.log('===================================================================\n');

  const fd = fs.openSync(srcPath, 'r');
  const wasmDir = path.resolve(rootDir, 'node_modules/web-ifc') + path.sep;

  try {
    const serializer = new FRAGS.IfcImporter();
    serializer.wasm = {
      absolute: true,
      path: wasmDir,
    };

    let lastReportedProgress = -1;
    const startTime = Date.now();
    let sharedBuffer = Buffer.allocUnsafe(65536);

    // Low-level chunk reader with unsigned 32-bit offset protection & buffer reuse
    const readCallback = (offset, size) => {
      try {
        const safeOffset = offset >>> 0;
        if (sharedBuffer.length < size) {
          sharedBuffer = Buffer.allocUnsafe(size);
        }
        const bytesRead = fs.readSync(fd, sharedBuffer, 0, size, safeOffset);
        return new Uint8Array(sharedBuffer.buffer, sharedBuffer.byteOffset, bytesRead);
      } catch (err) {
        console.error(`\n❌ Error reading IFC chunk at offset ${offset} (size ${size}):`, err);
        throw err;
      }
    };

    console.log('[1/2] Processing IFC geometry, spatial tree and properties...');

    const fragmentBytes = await serializer.process({
      readFromCallback: true,
      readCallback,
      progressCallback: (progress) => {
        const currentPct = Math.min(Math.round(progress * 100), 100);
        if (currentPct !== lastReportedProgress) {
          lastReportedProgress = currentPct;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          process.stdout.write(`\r      ⏳ Progress: [${'#'.repeat(Math.floor(currentPct / 5)).padEnd(20, ' ')}] ${currentPct}% (${elapsed}s)`);
          if (typeof process.send === 'function') {
            process.send({ type: 'progress', percent: currentPct, elapsed });
          }
        }
      },
    });

    process.stdout.write('\n\n[2/2] Generating and saving .frag file...\n');

    const targetDir = path.dirname(dstPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(dstPath, fragmentBytes);

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    const fragSizeMB = (fragmentBytes.byteLength / (1024 * 1024)).toFixed(2);
    const compressionRatio = ((1 - fragmentBytes.byteLength / partBytes) * 100).toFixed(1);

    if (typeof serializer.clean === 'function') {
      serializer.clean();
    }

    console.log('===================================================================');
    console.log(` ✅ PART COMPLETED: ${path.basename(dstPath)}`);
    console.log(` ⏱️ Time     : ${durationSec}s`);
    console.log(` 📦 Size     : ${fragSizeMB} MB (${compressionRatio}% reduction)`);
    console.log('===================================================================\n');

    return { outputPath: dstPath, fragSizeMB, durationSec };
  } finally {
    fs.closeSync(fd);
  }
}

// ===================================================================
// MAIN ENTRY POINT
// ===================================================================
async function main() {
  if (fileSizeBytes > MAX_SAFE_WASM_SIZE) {
    throw new Error(
      `Este motor no puede convertir ${fileSizeGB} GB en un solo .frag. ` +
      `web-ifc usa memoria WebAssembly de 32 bits; el límite seguro configurado es ${MAX_SAFE_WASM_SIZE / (1024 * 1024 * 1024)} GB. ` +
      'El IFC original se conserva intacto y no se dividirá. Se requiere un motor nativo compatible con FRAG para convertir este tamaño.'
    );
  }

  await convertSingleIfc(inputPath, outputPath);
  return;

}

main().catch((err) => {
  console.error('\n\n❌ Conversion failed with error:');
  console.error(err);
  process.exit(1);
});

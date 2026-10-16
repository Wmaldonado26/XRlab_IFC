import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
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
// Target size per partition for massive files (~1.25 GB raw text)
const TARGET_PARTITION_SIZE = 1.25 * 1024 * 1024 * 1024;

// 2. Parse command-line arguments
const rawArgs = process.argv.slice(2);
const isSingleMode = rawArgs.includes('--single');
const keepSplits = rawArgs.includes('--keep-splits');
const cleanArgs = rawArgs.filter((a) => a !== '--single' && a !== '--keep-splits');

if (cleanArgs.length === 0 || cleanArgs.includes('--help') || cleanArgs.includes('-h')) {
  console.log(`
===================================================================
 BIM ThatOpen Engine: High-Capacity IFC -> FRAG Converter
===================================================================
 Usage:
   npm run convert -- <path-to-ifc-file> [optional-output-path.frag]

 Flags:
   --keep-splits   Preserve intermediate .ifc partitions on disk

 Examples:
   npm run convert -- ./modelo.ifc
   npm run convert -- "C:/Proyectos/IFC_Entire_Ship_wo_ref_2026-07-16.ifc"
   npm run convert -- ./modelo.ifc ./public/models/modelo.frag

 High-Scale Architecture:
   - Single-Pass mode (<= 1.75 GB): Zero-copy streaming conversion.
   - Massive Model mode (> 1.75 GB): Dynamic N-way dependency-preserving
     partitioning into isolated WebAssembly processes, preventing 32-bit WASM
     heap exhaustion (Aborted OOM) and outputting valid .frag parts.
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

// Spawns a child process for isolated WebAssembly linear memory per partition
function runChildConversion(ifcFile, fragFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--max-old-space-size=16384', __filename, ifcFile, fragFile, '--single'],
      { stdio: 'inherit', cwd: process.cwd() }
    );

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Subprocess for ${path.basename(ifcFile)} exited with code ${code}`));
      }
    });
  });
}

// Types considered root structural/context metadata in IFC schemas
const ROOT_METADATA_TYPES = new Set([
  'IFCPROJECT',
  'IFCSITE',
  'IFCBUILDING',
  'IFCBUILDINGSTOREY',
  'IFCSPACE',
  'IFCGEOMETRICREPRESENTATIONCONTEXT',
  'IFCGEOMETRICREPRESENTATIONSUBCONTEXT',
  'IFCUNITASSIGNMENT',
  'IFCSIUNIT',
  'IFCCONVERSIONBASEDUNIT',
  'IFCDIMENSIONALEXPONENTS',
  'IFCAXIS2PLACEMENT3D',
  'IFCAXIS2PLACEMENT2D',
  'IFCDIRECTION',
  'IFCCARTESIANPOINT',
  'IFCPERSON',
  'IFCORGANIZATION',
  'IFCPERSONANDORGANIZATION',
  'IFCAPPLICATION',
  'IFCOWNERHISTORY',
  'IFCPOSTALADDRESS',
  'IFCLOCALPLACEMENT',
  'IFCRELAGGREGATES',
  'IFCRELCONTAINEDINSPATIALSTRUCTURE',
]);

// ===================================================================
// DYNAMIC N-WAY DEPENDENCY-PRESERVING PARTITIONER
// ===================================================================
async function partitionMassiveIfcDynamic(sourceIfc, partitionTargets) {
  const numParts = partitionTargets.length;
  console.log('\n===================================================================');
  console.log(` 🧩 DYNAMIC ${numParts}-WAY IFC PARTITIONING ACTIVATED`);
  console.log('===================================================================');
  console.log(' 💡 Archivo masivo que excede el límite lineal de WebAssembly de 32 bits.');
  console.log(`    Generando ${numParts} sub-modelos independientes y balanceados (< 1.5 GB)...`);
  console.log('===================================================================\n');

  const startTime = Date.now();
  const bytesPerPart = Math.ceil(fileSizeBytes / numParts);

  const idRegex = /^#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\(/;
  const refRegex = /#(\d+)/g;

  // PASS 1: Header scan, boundary entity determination, and dependency mapping
  console.log('[Pass 1/2] Scanning STEP entities and resolving cross-references...');

  const headerLines = [];
  let inDataSection = false;
  let currentBytes = 0;
  let lastProgress = -1;

  // We track which entities are root context to duplicate in all partitions
  const rootEntityIds = new Set();
  // We record partition boundary line/byte ranges
  const partBoundaries = [];
  for (let p = 0; p < numParts; p++) {
    partBoundaries.push({
      startByte: p * bytesPerPart,
      endByte: (p + 1) * bytesPerPart,
    });
  }

  // Bitset per partition for needed entity IDs
  const MAX_ENTITY_ID = 200000000;
  const bitsetByteSize = Math.ceil(MAX_ENTITY_ID / 8);
  const partBitsets = Array.from({ length: numParts }, () => new Uint8Array(bitsetByteSize));

  function markPartNeeded(partIdx, id) {
    if (id > 0 && id < MAX_ENTITY_ID) {
      partBitsets[partIdx][id >> 3] |= (1 << (id & 7));
    }
  }

  function isPartNeeded(partIdx, id) {
    if (id > 0 && id < MAX_ENTITY_ID) {
      return (partBitsets[partIdx][id >> 3] & (1 << (id & 7))) !== 0;
    }
    return false;
  }

  const pass1Stream = fs.createReadStream(sourceIfc, {
    encoding: 'utf8',
    highWaterMark: 1024 * 1024 * 8,
  });

  const rl1 = readline.createInterface({
    input: pass1Stream,
    crlfDelay: Infinity,
  });

  for await (const line of rl1) {
    const lineLen = Buffer.byteLength(line, 'utf8') + 1;
    currentBytes += lineLen;

    const pct = Math.min(Math.floor((currentBytes / fileSizeBytes) * 100), 100);
    if (pct !== lastProgress && pct % 10 === 0) {
      lastProgress = pct;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r      ⏳ Pass 1 Scanning: ${pct}% complete (${elapsed}s)...`);
    }

    if (!inDataSection) {
      headerLines.push(line);
      if (line.trim().toUpperCase() === 'DATA;') {
        inDataSection = true;
      }
      continue;
    }

    if (line.trim().toUpperCase() === 'ENDSEC;') {
      break;
    }

    const match = line.match(idRegex);
    if (!match) continue;

    const id = parseInt(match[1], 10);
    const typeUpper = match[2].toUpperCase();

    if (ROOT_METADATA_TYPES.has(typeUpper)) {
      rootEntityIds.add(id);
    }

    // Determine default partition for this entity by byte offset
    let targetPart = Math.min(numParts - 1, Math.floor(currentBytes / bytesPerPart));

    // Mark entity's referenced IDs as needed by this partition
    refRegex.lastIndex = 0;
    let rMatch;
    while ((rMatch = refRegex.exec(line)) !== null) {
      const refId = parseInt(rMatch[1], 10);
      if (refId !== id) {
        markPartNeeded(targetPart, refId);
      }
    }
  }

  console.log(`\n      ✓ Found ${rootEntityIds.size} root spatial/context entities (shared across all parts).`);

  // PASS 2: Streaming Generation of the Partitioned IFC files
  console.log('\n[Pass 2/2] Writing partitioned IFC sub-models to disk...');

  const partStreams = partitionTargets.map((target) =>
    fs.createWriteStream(target, { encoding: 'utf8' })
  );

  const headerContent = headerLines.join('\n') + '\n';
  for (const stream of partStreams) {
    stream.write(headerContent);
  }

  const pass2Stream = fs.createReadStream(sourceIfc, {
    encoding: 'utf8',
    highWaterMark: 1024 * 1024 * 8,
  });

  const rl2 = readline.createInterface({
    input: pass2Stream,
    crlfDelay: Infinity,
  });

  currentBytes = 0;
  inDataSection = false;
  lastProgress = -1;

  for await (const line of rl2) {
    const lineLen = Buffer.byteLength(line, 'utf8') + 1;
    currentBytes += lineLen;

    const pct = Math.min(Math.floor((currentBytes / fileSizeBytes) * 100), 100);
    if (pct !== lastProgress && pct % 10 === 0) {
      lastProgress = pct;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r      ⏳ Pass 2 Writing: ${pct}% complete (${elapsed}s)...`);
    }

    if (!inDataSection) {
      if (line.trim().toUpperCase() === 'DATA;') {
        inDataSection = true;
      }
      continue;
    }

    if (line.trim().toUpperCase() === 'ENDSEC;') {
      break;
    }

    const match = line.match(idRegex);
    if (!match) {
      // Non-entity line, write to all parts
      for (const stream of partStreams) {
        stream.write(line + '\n');
      }
      continue;
    }

    const id = parseInt(match[1], 10);
    const isRoot = rootEntityIds.has(id);
    const assignedPart = Math.min(numParts - 1, Math.floor(currentBytes / bytesPerPart));

    for (let p = 0; p < numParts; p++) {
      // An entity is written to part P if:
      // 1. It is a root/context entity, OR
      // 2. It naturally belongs to part P's byte range, OR
      // 3. It was explicitly referenced by an entity in part P
      if (isRoot || p === assignedPart || isPartNeeded(p, id)) {
        partStreams[p].write(line + '\n');
      }
    }
  }

  // Close all streams with standard STEP footer
  for (const stream of partStreams) {
    stream.write('ENDSEC;\nEND-ISO-10303-21;\n');
    stream.end();
  }

  await Promise.all(
    partStreams.map((s) => new Promise((resolve) => s.on('finish', resolve)))
  );

  const partitionDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n      ✅ Partitioning complete in ${partitionDuration}s:`);
  for (let p = 0; p < numParts; p++) {
    const pSizeMB = (fs.statSync(partitionTargets[p]).size / (1024 * 1024)).toFixed(1);
    console.log(`         - Part ${p + 1}: ${pSizeMB} MB (${path.basename(partitionTargets[p])})`);
  }
  console.log('');
}

// ===================================================================
// MAIN ENTRY POINT
// ===================================================================
async function main() {
  // If running in single-part mode (e.g. child worker) or file fits in WASM:
  if (isSingleMode || fileSizeBytes <= MAX_SAFE_WASM_SIZE) {
    await convertSingleIfc(inputPath, outputPath);
    return;
  }

  // MASSIVE FILE DETECTED (> 1.75 GB)
  console.log('\n===================================================================');
  console.log(' 🚀 BIM IFC -> FRAG HIGH-CAPACITY CONVERSION PIPELINE');
  console.log('===================================================================');
  console.log(` 📂 Source File     : ${inputPath}`);
  console.log(` 📊 Total Size      : ${fileSizeGB} GB (${fileSizeMB} MB)`);
  console.log(` 🛡️ File Access Mode: STRICT READ-ONLY (Original file remains 100% intact)`);
  console.log('===================================================================\n');

  const dirName = path.dirname(outputPath);
  const baseName = path.basename(outputPath, '.frag');

  // Determine number of partitions dynamically so every partition is comfortably <= 1.3 GB
  const numParts = Math.max(2, Math.ceil(fileSizeBytes / TARGET_PARTITION_SIZE));

  const partitionIfcFiles = [];
  const partitionFragFiles = [];

  for (let i = 1; i <= numParts; i++) {
    partitionIfcFiles.push(path.join(dirName, `${baseName}_Part${i}.ifc`));
    partitionFragFiles.push(path.join(dirName, `${baseName}_Part${i}.frag`));
  }

  // Step 1: Partition into valid sub-models under 1.5 GB
  await partitionMassiveIfcDynamic(inputPath, partitionIfcFiles);

  // Step 2: Convert each partition in an isolated child process
  for (let i = 0; i < numParts; i++) {
    const ifcPart = partitionIfcFiles[i];
    const fragPart = partitionFragFiles[i];
    console.log(`⏳ Starting conversion of Part ${i + 1}/${numParts} in an isolated WebAssembly instance...`);
    await runChildConversion(ifcPart, fragPart);
  }

  // Step 3: Cleanup temporary IFC partition files unless requested to keep
  if (!keepSplits) {
    console.log('🧹 Cleaning up temporary partitioned IFC files...');
    for (const ifcPart of partitionIfcFiles) {
      if (fs.existsSync(ifcPart)) {
        try { fs.unlinkSync(ifcPart); } catch {}
      }
    }
    console.log(`   Temporary files removed (freed disk space).`);
  } else {
    console.log('💾 Kept intermediate .ifc files as requested:');
    partitionIfcFiles.forEach((f) => console.log(`   - ${f}`));
  }

  console.log('\n===================================================================');
  console.log(' 🎉 ALL CONVERSIONS COMPLETED SUCCESSFULLY!');
  console.log('===================================================================');
  partitionFragFiles.forEach((fragPart, idx) => {
    const sz = fs.existsSync(fragPart) ? (fs.statSync(fragPart).size / (1024 * 1024)).toFixed(2) : '0';
    console.log(` 📦 Generated Fragment Part ${idx + 1} : ${fragPart} (${sz} MB)`);
  });
  console.log('===================================================================');
}

main().catch((err) => {
  console.error('\n\n❌ Conversion failed with error:');
  console.error(err);
  process.exit(1);
});

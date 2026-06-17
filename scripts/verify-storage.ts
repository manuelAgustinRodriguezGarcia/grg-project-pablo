import "dotenv/config";
import {
  ALL_STORAGE_BUCKETS,
  createSignedDownloadUrl,
  deleteFile,
  ensureStorageBuckets,
  listStorageBuckets,
  STORAGE_BUCKETS,
  uploadFile,
} from "../src/server/storage";

const TEST_PATH = "_healthcheck/storage-verify.txt";
const TEST_CONTENT = "grg-storage-verify";
const TEST_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TEST_FILENAME = "verify.xlsx";

async function verifyBucketsExist(): Promise<void> {
  const buckets = await listStorageBuckets();
  const missing = ALL_STORAGE_BUCKETS.filter((name) => !buckets.includes(name));

  if (missing.length > 0) {
    throw new Error(`Buckets no encontrados: ${missing.join(", ")}`);
  }

  for (const name of ALL_STORAGE_BUCKETS) {
    console.log(`✓ Bucket existe: ${name}`);
  }
}

async function verifyUploadFlow(): Promise<void> {
  const bucket = STORAGE_BUCKETS.TEMP_IMPORTS;

  await uploadFile({
    bucket,
    path: TEST_PATH,
    body: Buffer.from(TEST_CONTENT, "utf-8"),
    contentType: TEST_MIME,
    originalFilename: TEST_FILENAME,
    upsert: true,
  });
  console.log(`✓ Subida de prueba OK (${bucket}/${TEST_PATH})`);

  const signed = await createSignedDownloadUrl(bucket, TEST_PATH, 60);
  const response = await fetch(signed.signedUrl);

  if (!response.ok) {
    throw new Error(
      `URL firmada no accesible: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const downloaded = await response.text();
  if (downloaded !== TEST_CONTENT) {
    throw new Error("Contenido descargado no coincide con el archivo subido.");
  }

  console.log("✓ URL firmada de descarga OK");

  await deleteFile(bucket, TEST_PATH);
  console.log("✓ Eliminación de archivo de prueba OK");
}

async function main(): Promise<void> {
  await ensureStorageBuckets();
  await verifyBucketsExist();
  await verifyUploadFlow();
  console.log("Verificación de Storage completada.");
}

main().catch((error: unknown) => {
  console.error("✗ Verificación de Storage fallida:", error);
  process.exit(1);
});

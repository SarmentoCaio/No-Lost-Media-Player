import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const enabled = process.env.VITE_PS2_ENABLED !== "false" || process.argv.includes("--force");
const localDirectory = process.env.PLAY_RUNTIME_LOCAL_DIR?.trim();
const runtimeRoot = resolve(root, "public", "emulator", "ps2", "runtime");
const pointerPath = resolve(root, "public", "emulator", "ps2", "play-runtime.json");

if (!enabled && !localDirectory) {
  await rm(runtimeRoot, { recursive: true, force: true });
  await rm(pointerPath, { force: true });
  console.log("Play! runtime disabled; skipping download.");
  process.exit(0);
}

const lock = JSON.parse(await readFile(resolve(root, "play-runtime.lock.json"), "utf8"));

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function validateManifest(manifest) {
  if (!/^web-v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(manifest.version ?? "")) {
    throw new Error("O manifesto Play! contém uma versão inválida.");
  }
  if (manifest.emscripten !== "4.0.1" || manifest.threadPoolSize !== 2
      || typeof manifest.files !== "object" || manifest.files === null) {
    throw new Error("O manifesto Play! não corresponde à configuração suportada.");
  }
  for (const required of ["Play.js", "Play.wasm", "Play.d.ts", "License.txt"]) {
    if (!(required in manifest.files)) throw new Error(`O manifesto Play! não contém ${required}.`);
  }
  for (const [name, metadata] of Object.entries(manifest.files)) {
    if (basename(name) !== name || !/^[A-Za-z0-9._-]+$/.test(name)
        || !/^[a-f0-9]{64}$/i.test(metadata?.sha256 ?? "")
        || !Number.isSafeInteger(metadata?.size) || metadata.size < 0) {
      throw new Error(`Entrada inválida no manifesto Play!: ${name}`);
    }
  }
}

async function existingRuntimeIsValid() {
  try {
    const pointer = JSON.parse(await readFile(pointerPath, "utf8"));
    if (pointer.version !== lock.version) return false;
    const directory = resolve(runtimeRoot, lock.version);
    const manifest = JSON.parse(await readFile(resolve(directory, "runtime-manifest.json"), "utf8"));
    validateManifest(manifest);
    for (const [name, metadata] of Object.entries(manifest.files)) {
      const bytes = await readFile(resolve(directory, name));
      if (bytes.byteLength !== metadata.size || sha256(bytes) !== metadata.sha256) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function installLocal(directory) {
  const source = resolve(directory);
  const manifest = JSON.parse(await readFile(resolve(source, "runtime-manifest.json"), "utf8"));
  validateManifest(manifest);
  const target = resolve(runtimeRoot, manifest.version);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  for (const [name, metadata] of Object.entries(manifest.files)) {
    const bytes = await readFile(resolve(source, name));
    if (sha256(bytes) !== metadata.sha256 || bytes.byteLength !== metadata.size) {
      throw new Error(`Integridade inválida para ${name} na build local.`);
    }
  }
  await cp(source, target, { recursive: true });
  return { version: manifest.version, runtimePath: `/emulator/ps2/runtime/${manifest.version}/` };
}

async function installRelease() {
  const manifestResponse = await fetch(lock.manifestUrl, { redirect: "follow" });
  if (!manifestResponse.ok) throw new Error(`Falha ao baixar manifesto Play!: HTTP ${manifestResponse.status}`);
  const manifestBytes = Buffer.from(await manifestResponse.arrayBuffer());
  if (sha256(manifestBytes) !== lock.manifestSha256) throw new Error("SHA-256 do manifesto Play! não confere.");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  validateManifest(manifest);
  if (manifest.version !== lock.version) throw new Error("Manifesto Play! incompatível com o lock.");

  const target = resolve(runtimeRoot, lock.version);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  const releaseBase = new URL("./", lock.manifestUrl);
  for (const [name, metadata] of Object.entries(manifest.files)) {
    const response = await fetch(new URL(name, releaseBase), { redirect: "follow" });
    if (!response.ok) throw new Error(`Falha ao baixar ${name}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (sha256(bytes) !== metadata.sha256 || bytes.byteLength !== metadata.size) {
      throw new Error(`Integridade inválida para ${name}.`);
    }
    await writeFile(resolve(target, name), bytes);
  }
  await writeFile(resolve(target, "runtime-manifest.json"), manifestBytes);
  return { version: lock.version, runtimePath: `/emulator/ps2/runtime/${lock.version}/` };
}

await mkdir(runtimeRoot, { recursive: true });
if (!localDirectory && await existingRuntimeIsValid()) {
  console.log(`Play! runtime ${lock.version} already installed.`);
  process.exit(0);
}
const pointer = localDirectory ? await installLocal(localDirectory) : await installRelease();
await writeFile(pointerPath, `${JSON.stringify(pointer, null, 2)}\n`);
console.log(`Play! runtime ${pointer.version} installed.`);

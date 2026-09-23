export interface DiscRuntimeMemory { HEAPU8: Uint8Array; }

export interface DiscImageDevice {
  attach(module: DiscRuntimeMemory): void;
  cancel(): void;
  getFileSize(): number;
  getReadStatus(): -1 | 0 | 1;
  read(destination: number, offset: number, size: number): void;
}

abstract class BaseDiscDevice implements DiscImageDevice {
  protected module: DiscRuntimeMemory | null = null;
  protected readStatus: -1 | 0 | 1 = 1;
  protected generation = 0;
  abstract getFileSize(): number;
  protected abstract readBytes(offset: number, size: number): Promise<Uint8Array>;
  attach(module: DiscRuntimeMemory) { this.module = module; }
  getReadStatus() { return this.readStatus; }
  read(destination: number, offset: number, size: number) {
    const generation = ++this.generation;
    this.readStatus = 0;
    void this.readBytes(offset, size).then((bytes) => {
      if (generation !== this.generation || !this.module) return;
      if (bytes.byteLength !== size) throw new Error("A leitura da imagem retornou um bloco incompleto.");
      this.module.HEAPU8.set(bytes, destination);
      this.readStatus = 1;
    }).catch((error: unknown) => {
      console.error("Falha na leitura da imagem PS2:", error);
      if (generation === this.generation) this.readStatus = -1;
    });
  }
  cancel() { this.generation += 1; this.readStatus = -1; this.module = null; }
}

export class FileDiscDevice extends BaseDiscDevice {
  constructor(private readonly file: File) { super(); }
  getFileSize() { return this.file.size; }
  protected async readBytes(offset: number, size: number) {
    return new Uint8Array(await this.file.slice(offset, offset + size).arrayBuffer());
  }
}

export class RangeDiscDevice extends BaseDiscDevice {
  static readonly BLOCK_SIZE = 4 * 1024 * 1024;
  static readonly CACHE_LIMIT = 64 * 1024 * 1024;
  private readonly cache = new Map<number, Uint8Array>();
  private readonly inflight = new Map<number, Promise<Uint8Array>>();
  private readonly controller = new AbortController();
  private cachedBytes = 0;
  private constructor(private readonly url: string, private readonly fileSize: number, private readonly identity: string) { super(); }

  static async create(url: string) {
    const currentOrigin = typeof window === "undefined" ? "https://localhost" : window.location.origin;
    const parsed = new URL(url, currentOrigin);
    if (parsed.protocol !== "https:" && parsed.origin !== currentOrigin) {
      throw new Error("A imagem PS2 remota precisa usar HTTPS.");
    }
    const response = await fetch(parsed, { headers: { Range: "bytes=0-0" }, credentials: "omit", cache: "no-store" });
    if (response.status !== 206) throw new Error("O servidor da imagem PS2 não oferece HTTP Range.");
    const match = response.headers.get("Content-Range")?.match(/^bytes 0-0\/(\d+)$/i);
    if (!match) throw new Error("O servidor retornou um Content-Range inválido.");
    const fileSize = Number(match[1]);
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0) throw new Error("O tamanho da imagem PS2 é inválido.");
    const identity = response.headers.get("ETag") ?? response.headers.get("Last-Modified") ?? "";
    if (!identity) throw new Error("O servidor precisa expor ETag ou Last-Modified para imagens PS2.");
    return new RangeDiscDevice(parsed.href, fileSize, identity);
  }

  getFileSize() { return this.fileSize; }
  private remember(index: number, bytes: Uint8Array) {
    const previous = this.cache.get(index);
    if (previous) this.cachedBytes -= previous.byteLength;
    this.cache.delete(index);
    this.cache.set(index, bytes);
    this.cachedBytes += bytes.byteLength;
    while (this.cachedBytes > RangeDiscDevice.CACHE_LIMIT) {
      const oldest = this.cache.entries().next().value as [number, Uint8Array] | undefined;
      if (!oldest) break;
      this.cache.delete(oldest[0]);
      this.cachedBytes -= oldest[1].byteLength;
    }
  }

  private async getBlock(index: number): Promise<Uint8Array> {
    const cached = this.cache.get(index);
    if (cached) { this.cache.delete(index); this.cache.set(index, cached); return cached; }
    const pending = this.inflight.get(index);
    if (pending) return pending;
    const start = index * RangeDiscDevice.BLOCK_SIZE;
    const end = Math.min(this.fileSize - 1, start + RangeDiscDevice.BLOCK_SIZE - 1);
    const request = fetch(this.url, {
      headers: { Range: `bytes=${start}-${end}` }, credentials: "omit", signal: this.controller.signal,
    }).then(async (response) => {
      if (response.status !== 206) throw new Error("O servidor deixou de responder com HTTP 206.");
      if (response.headers.get("Content-Range") !== `bytes ${start}-${end}/${this.fileSize}`) {
        throw new Error("O servidor retornou um intervalo diferente do solicitado.");
      }
      const identity = response.headers.get("ETag") ?? response.headers.get("Last-Modified") ?? "";
      if (identity !== this.identity) throw new Error("A imagem PS2 mudou durante a sessão.");
      const encoding = response.headers.get("Content-Encoding");
      if (encoding && encoding !== "identity") throw new Error("O servidor não pode comprimir respostas Range.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== end - start + 1) throw new Error("O servidor retornou um bloco incompleto.");
      this.remember(index, bytes);
      return bytes;
    }).finally(() => this.inflight.delete(index));
    this.inflight.set(index, request);
    return request;
  }

  protected async readBytes(offset: number, size: number) {
    if (offset < 0 || size <= 0 || offset + size > this.fileSize) throw new Error("Leitura fora da imagem PS2.");
    const first = Math.floor(offset / RangeDiscDevice.BLOCK_SIZE);
    const last = Math.floor((offset + size - 1) / RangeDiscDevice.BLOCK_SIZE);
    const blocks = await Promise.all(Array.from({ length: last - first + 1 }, (_, position) => this.getBlock(first + position)));
    const result = new Uint8Array(size);
    let written = 0;
    for (let index = first; index <= last; index += 1) {
      const block = blocks[index - first];
      const blockStart = index * RangeDiscDevice.BLOCK_SIZE;
      const from = Math.max(offset, blockStart) - blockStart;
      const to = Math.min(offset + size, blockStart + block.byteLength) - blockStart;
      result.set(block.subarray(from, to), written);
      written += to - from;
    }
    if (last + 1 < Math.ceil(this.fileSize / RangeDiscDevice.BLOCK_SIZE)) void this.getBlock(last + 1).catch(() => undefined);
    return result;
  }

  override cancel() {
    this.controller.abort(); this.cache.clear(); this.inflight.clear(); this.cachedBytes = 0; super.cancel();
  }
}

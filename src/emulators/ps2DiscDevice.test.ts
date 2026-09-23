import { afterEach, describe, expect, it, vi } from "vitest";
import { RangeDiscDevice } from "./ps2DiscDevice";

const identity = '"fixture-v1"';

function response(body: BodyInit | null, range: string, etag = identity) {
  return new Response(body, {
    status: 206,
    headers: {
      "Content-Range": range,
      ETag: etag,
      "Content-Encoding": "identity",
    },
  });
}

async function waitForRead(device: RangeDiscDevice) {
  for (let attempt = 0; attempt < 50 && device.getReadStatus() === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("PS2 remote Range source", () => {
  it("requires HTTPS and a valid 206 probe", async () => {
    await expect(RangeDiscDevice.create("http://roms.example/game.iso")).rejects.toThrow("HTTPS");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    await expect(RangeDiscDevice.create("https://roms.example/game.iso")).rejects.toThrow("HTTP Range");
  });

  it("reads only requested blocks and reuses the LRU cache", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(new Uint8Array([0]), "bytes 0-0/8"))
      .mockResolvedValueOnce(response(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]), "bytes 0-7/8"));
    vi.stubGlobal("fetch", fetchMock);
    const device = await RangeDiscDevice.create("https://roms.example/game.iso");
    const memory = { HEAPU8: new Uint8Array(16) };
    device.attach(memory);

    device.read(4, 2, 3);
    await waitForRead(device);
    expect(device.getReadStatus()).toBe(1);
    expect([...memory.HEAPU8.slice(4, 7)]).toEqual([2, 3, 4]);

    device.read(0, 0, 2);
    await waitForRead(device);
    expect([...memory.HEAPU8.slice(0, 2)]).toEqual([0, 1]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails a read if the remote file identity changes", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response(new Uint8Array([0]), "bytes 0-0/4"))
      .mockResolvedValueOnce(response(new Uint8Array([0, 1, 2, 3]), "bytes 0-3/4", '"fixture-v2"')));
    const device = await RangeDiscDevice.create("https://roms.example/game.iso");
    device.attach({ HEAPU8: new Uint8Array(4) });
    device.read(0, 0, 4);
    await waitForRead(device);
    expect(device.getReadStatus()).toBe(-1);
  });

  it("aborts an in-flight block when the session is destroyed", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(new Uint8Array([0]), "bytes 0-0/4"))
      .mockImplementationOnce((_url: URL | string, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }));
    vi.stubGlobal("fetch", fetchMock);
    const device = await RangeDiscDevice.create("https://roms.example/game.iso");
    device.attach({ HEAPU8: new Uint8Array(4) });
    device.read(0, 0, 4);
    device.cancel();
    await waitForRead(device);
    expect(device.getReadStatus()).toBe(-1);
  });
});

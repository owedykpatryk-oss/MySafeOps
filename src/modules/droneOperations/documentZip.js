import { Inflate, strFromU8 } from "fflate";
const MAX = 8 * 1024 * 1024;
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const fail = (message) => {
  throw new Error(message);
};
// Read only the Word document body. Actual output is counted as each small
// compressed chunk expands; declared ZIP sizes never allocate/truncate output.
export function readDocxBody(bytes) {
  if (bytes.length > MAX) fail("Import a document up to 8 MB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (p) => view.getUint16(p, true),
    u32 = (p) => view.getUint32(p, true);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
    if (u32(p) === 0x06054b50 && p + 22 + u16(p + 20) === bytes.length) {
      end = p;
      break;
    }
  }
  if (end < 0 || u16(end + 4) || u16(end + 6) || u16(end + 8) !== u16(end + 10))
    fail("Unsupported DOCX archive directory.");
  const count = u16(end + 10),
    directory = u32(end + 16),
    directoryEnd = directory + u32(end + 12);
  if (count > 200 || directoryEnd !== end) fail("Unsafe DOCX archive directory or too many entries.");
  let position = directory,
    total = 0,
    body = null;
  for (let i = 0; i < count; i++) {
    if (position + 46 > directoryEnd || u32(position) !== 0x02014b50) fail("Malformed DOCX archive entry.");
    const flags = u16(position + 8),
      method = u16(position + 10),
      crc = u32(position + 16),
      size = u32(position + 20),
      expanded = u32(position + 24);
    const nameLength = u16(position + 28),
      local = u32(position + 42);
    const next = position + 46 + nameLength + u16(position + 30) + u16(position + 32);
    if (next > directoryEnd || local + 30 > directory || flags & 1 || u16(position + 34) || ![0, 8].includes(method))
      fail("Unsupported, encrypted or malformed DOCX archive.");
    const name = strFromU8(bytes.subarray(position + 46, position + 46 + nameLength));
    if (name.split(/[\\/]/).includes("..") || /^[\\/]|^[a-z]:/i.test(name)) fail("Unsafe DOCX archive path.");
    total += expanded;
    if (total > 20 * 1024 * 1024 || expanded > MAX || expanded / Math.max(1, size) > 150)
      fail("DOCX expanded size or compression ratio exceeds limits.");
    if (u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method)
      fail("DOCX local entry differs from its directory.");
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    if (
      start > directory ||
      start + size > directory ||
      strFromU8(bytes.subarray(local + 30, local + 30 + u16(local + 26))) !== name
    )
      fail("Malformed DOCX entry bounds or name.");
    if (!(flags & 8) && (u32(local + 14) !== crc || u32(local + 18) !== size || u32(local + 22) !== expanded))
      fail("DOCX entry sizes or checksum metadata disagree.");
    if (name === "word/document.xml") {
      if (body) fail("DOCX has duplicate document bodies.");
      const chunks = [];
      let length = 0,
        checksum = 0xffffffff;
      const collect = (data) => {
        length += data.length;
        if (length > MAX || length > expanded) fail("DOCX actual expanded size exceeds limits or declared size.");
        for (const byte of data) checksum = crcTable[(checksum ^ byte) & 255] ^ (checksum >>> 8);
        chunks.push(data.slice());
      };
      if (method === 0) collect(bytes.subarray(start, start + size));
      else {
        const inflater = new Inflate(collect);
        for (let offset = 0; offset < size; offset += 1024)
          inflater.push(bytes.subarray(start + offset, start + Math.min(size, offset + 1024)), offset + 1024 >= size);
      }
      if (length !== expanded || (checksum ^ 0xffffffff) >>> 0 !== crc)
        fail("DOCX body size or checksum does not match the original file.");
      body = new Uint8Array(length);
      let cursor = 0;
      for (const chunk of chunks) {
        body.set(chunk, cursor);
        cursor += chunk.length;
      }
    }
    position = next;
  }
  if (position !== directoryEnd || !body) fail("DOCX has no valid document body.");
  return strFromU8(body);
}

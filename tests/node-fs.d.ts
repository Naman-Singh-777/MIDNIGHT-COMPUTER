// The one Node API the data tests use, declared here so the project does not need @types/node.
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array & { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

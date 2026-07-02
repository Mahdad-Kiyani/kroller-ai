/**
 * `socks-proxy-agent` ships types only via its package.json "exports" map, which
 * TypeScript's classic ("node") module resolution can't see. This ambient shim covers
 * the one constructor call this project makes; axios accepts it as `httpsAgent: any`.
 */
declare module 'socks-proxy-agent' {
  export class SocksProxyAgent {
    constructor(uri: string, opts?: Record<string, unknown>);
  }
}

export type LyftaErrorKind =
  'unauthorized' | 'rate_limited' | 'bad_request' | 'server' | 'network' | 'invalid_response';

/**
 * Single error type for everything that can go wrong talking to Lyfta, so callers can branch on
 * `kind` instead of parsing messages.
 */
export class LyftaError extends Error {
  readonly kind: LyftaErrorKind;
  readonly status?: number;

  constructor(kind: LyftaErrorKind, message: string, status?: number) {
    super(message);
    // Restore the prototype so `instanceof LyftaError` survives compilation to older targets.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'LyftaError';
    this.kind = kind;
    this.status = status;
  }
}

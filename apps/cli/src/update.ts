export interface UpdateNotice { version: string; command: string }

interface Version { core: bigint[]; prerelease: string[] }
function parseVersion(value: unknown): Version | undefined {
  if (typeof value !== 'string') return;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/.exec(value);
  if (!match) return;
  const prerelease = match[4]?.split('.') || [];
  if (prerelease.some(part => /^0\d+$/.test(part))) return;
  return { core: match.slice(1, 4).map(BigInt), prerelease };
}

export function isNewerVersion(candidate: string, installed: string): boolean {
  const a = parseVersion(candidate), b = parseVersion(installed);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i];
  if (!a.prerelease.length || !b.prerelease.length) return a.prerelease.length === 0 && b.prerelease.length > 0;
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const x = a.prerelease[i], y = b.prerelease[i];
    if (x === undefined || y === undefined) return x !== undefined;
    if (x === y) continue;
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    if (xn && yn) return BigInt(x) > BigInt(y);
    if (xn !== yn) return !xn;
    return x > y;
  }
  return false;
}

/** An optional startup hint: network or registry problems must never prevent play. */
export async function checkForUpdate(installed: string, options: {
  fetch?: typeof fetch;
  timeoutMs?: number;
  homebrew?: boolean;
} = {}): Promise<UpdateNotice | undefined> {
  const current = parseVersion(installed);
  if (!current) return;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const lookup = async (): Promise<UpdateNotice | undefined> => {
      const response = await (options.fetch || fetch)('https://registry.npmjs.org/-/package/zchess/dist-tags', { signal: controller.signal });
      if (!response.ok) return;
      const tags = await response.json() as Record<string, unknown> | null;
      if (!tags || typeof tags !== 'object') return;
      const candidates = [tags.latest];
      if (current.prerelease.length && !options.homebrew) candidates.push(tags[current.prerelease[0]]);
      let version = installed;
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && isNewerVersion(candidate, version)) version = candidate;
      }
      if (version === installed) return;
      return { version, command: options.homebrew
        ? `brew reinstall --formula \\
  https://github.com/kennylwx/zchess/releases/latest/download/zchess.rb`
        : `npm install --global zchess@${version}` };
    };
    const timeout = new Promise<undefined>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(undefined); }, options.timeoutMs ?? 800);
    });
    return await Promise.race([lookup(), timeout]);
  } catch { return; }
  finally { if (timer) clearTimeout(timer); }
}

import { writeFile } from 'node:fs/promises';

const [version, tarball, sha256, output] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version ?? '') || !/^https:\/\/registry\.npmjs\.org\//.test(tarball ?? '') || !/^[a-f0-9]{64}$/.test(sha256 ?? '') || !output) {
  throw new Error('Usage: node generate-homebrew-formula.mjs VERSION NPM_TARBALL_URL SHA256 OUTPUT');
}

const formula = `class ChessCli < Formula
  desc "Play terminal chess against the included Stockfish engine"
  homepage "https://github.com/kennylwx/chess"
  url "${tarball}"
  sha256 "${sha256}"
  license "MIT"

  depends_on "node@22"

  def fetch
    system "npm", "install", "--prefix", buildpath/"package", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"
  end

  def install
    libexec.install "package"
    bin.install_symlink libexec/"package/node_modules/.bin/chess"
  end

  test do
    assert_match "terminal chess", shell_output("#{bin}/chess --help")
  end
end
`;

await writeFile(output, formula);

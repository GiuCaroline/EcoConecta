import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
async function files(dir) {
  const list = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      list.map(async (entry) =>
        entry.isDirectory()
          ? files(`${dir}/${entry.name}`)
          : [`${dir}/${entry.name}`],
      ),
    )
  ).flat();
}
for (const path of [
  ...(await files("src")),
  ...(await files("scripts")),
  ...(await files("tests")),
].filter((f) => f.endsWith(".js"))) {
  const result = spawnSync(process.execPath, ["--check", path], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("Sintaxe JavaScript verificada.");

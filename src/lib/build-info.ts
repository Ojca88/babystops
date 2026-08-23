import { execSync } from "node:child_process";

// Se evalúa en el servidor (build time para páginas estáticas, cada
// request en `next dev`) — nunca en el navegador.
export function getLastCommitDate(): Date | null {
  try {
    const iso = execSync("git log -1 --format=%cI", { cwd: process.cwd() }).toString().trim();
    return iso ? new Date(iso) : null;
  } catch {
    return null;
  }
}

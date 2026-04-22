import { decidePreRead } from "./pre-read";

export { decidePreRead };

export function decideCodexPreRead(filePath: string, cwd = process.cwd()) {
  return decidePreRead(filePath, cwd);
}

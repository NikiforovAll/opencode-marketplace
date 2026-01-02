import { run } from "./cli";

export async function main() {
  run();
}

if (import.meta.main) {
  main();
}

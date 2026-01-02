import { cac } from "cac";
import { version } from "../package.json";
import { install } from "./commands/install";
import { list } from "./commands/list";
import { scan } from "./commands/scan";
import { uninstall } from "./commands/uninstall";

export function run(argv = process.argv) {
  const cli = cac("opencode-marketplace");

  cli
    .command("install <path>", "Install a plugin from a local directory")
    .option("--scope <scope>", "Installation scope (user/project)", { default: "user" })
    .option("--force", "Overwrite existing components", { default: false })
    .action((path, options) => {
      if (options.scope !== "user" && options.scope !== "project") {
        console.error(`Invalid scope: ${options.scope}. Must be 'user' or 'project'.`);
        process.exit(1);
      }
      return install(path, options);
    });

  cli
    .command("uninstall <name>", "Uninstall a plugin")
    .option("--scope <scope>", "Installation scope (user/project)", { default: "user" })
    .action((name, options) => {
      if (options.scope !== "user" && options.scope !== "project") {
        console.error(`Invalid scope: ${options.scope}. Must be 'user' or 'project'.`);
        process.exit(1);
      }
      return uninstall(name, options);
    });

  cli
    .command("list", "List installed plugins")
    .option("--scope <scope>", "Filter by scope (user/project)")
    .action((options) => {
      if (options.scope && options.scope !== "user" && options.scope !== "project") {
        console.error(`Invalid scope: ${options.scope}. Must be 'user' or 'project'.`);
        process.exit(1);
      }
      return list(options);
    });

  cli
    .command("scan <path>", "Scan a directory for plugin components (dry-run)")
    .action((path, options) => {
      return scan(path, options);
    });

  // Global options
  cli.option("--verbose", "Enable verbose logging");

  cli.help();
  cli.version(version);

  try {
    cli.parse(argv);
  } catch (error) {
    if (error instanceof Error && error.message.includes("missing required args")) {
      console.error(error.message);
      cli.outputHelp();
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

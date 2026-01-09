import { getDefaultImportConfigPath, loadImportConfig } from "../import-config";
import { install } from "./install";

export interface ImportOptions {
  targetDir?: string;
  force: boolean;
  verbose?: boolean;
}

export async function importPlugins(configPath: string | undefined, options: ImportOptions) {
  const { targetDir, force, verbose } = options;
  const actualConfigPath = configPath || getDefaultImportConfigPath();

  try {
    console.log(`Importing plugins from ${actualConfigPath}...\n`);

    const config = await loadImportConfig(actualConfigPath);

    if (config.plugins.length === 0) {
      console.log("No plugins found in configuration.");
      return;
    }

    const results = {
      installed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    for (let i = 0; i < config.plugins.length; i++) {
      const source = config.plugins[i];
      const displayNum = `[${i + 1}/${config.plugins.length}]`;

      console.log(`${displayNum} ${source}`);

      try {
        const result = await install(source, {
          scope: "user",
          force,
          verbose,
          skipIfSameHash: true,
          targetDir,
        });

        if (result.status === "installed") results.installed++;
        else if (result.status === "updated") results.updated++;
        else if (result.status === "skipped") results.skipped++;
      } catch (error) {
        results.failed++;
        console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
      }
      console.log(""); // Empty line between plugins
    }

    console.log("Import complete:");
    console.log(`  Installed: ${results.installed}`);
    console.log(`  Updated:   ${results.updated}`);
    console.log(`  Skipped:   ${results.skipped}`);
    console.log(`  Failed:    ${results.failed}`);

    if (results.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

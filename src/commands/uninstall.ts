export interface UninstallOptions {
  scope: "user" | "project";
  verbose?: boolean;
}

export async function uninstall(name: string, options: UninstallOptions) {
  if (options.verbose) {
    console.log(`[VERBOSE] Uninstalling plugin ${name} with options:`, options);
  } else {
    console.log(`Uninstalling plugin ${name}...`);
  }

  // Implementation will be added later
  console.log("Uninstall command not implemented yet.");
}

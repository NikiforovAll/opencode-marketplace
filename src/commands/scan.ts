export interface ScanOptions {
  verbose?: boolean;
}

export async function scan(path: string, options: ScanOptions) {
  if (options.verbose) {
    console.log(`[VERBOSE] Scanning path ${path} with options:`, options);
  }

  // Implementation will be added later
  console.log("Scan command not implemented yet.");
}

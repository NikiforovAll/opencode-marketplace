export interface ListOptions {
  scope: "user" | "project";
  verbose?: boolean;
}

export async function list(options: ListOptions) {
  if (options.verbose) {
    console.log(`[VERBOSE] Listing plugins with options:`, options);
  }

  // Implementation will be added later
  console.log("List command not implemented yet.");
}

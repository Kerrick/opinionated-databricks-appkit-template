/** A component that fails while it is drawn, to see what the app shows when something breaks. */
export function Crash({ error }: { readonly error: Error }): never {
  throw error;
}

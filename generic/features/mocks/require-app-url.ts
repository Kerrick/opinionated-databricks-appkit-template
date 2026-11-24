/** Stops the smoke run, with a plain message, when it has no deployed app to visit. */
export default function requireAppUrl(): void {
  if (!process.env['APP_URL']) {
    throw new Error('test:smoke needs APP_URL, the address of the deployed app.');
  }
}

import { createApp, server } from '@databricks/appkit';

/**
 * The server the journeys talk to: AppKit's own server, serving the built client, with none of the project's
 * plugins. The plugins need resources a project binds when it is deployed (a warehouse, a database, a volume),
 * so what the browser asks of them is faked in the browser instead, and each plugin's routes are tested where
 * they live, with AppKit's testing kit.
 */
await createApp({ plugins: [server()] });

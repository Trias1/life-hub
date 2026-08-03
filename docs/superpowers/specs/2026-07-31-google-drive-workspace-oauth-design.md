# Workspace Google Drive OAuth

## Decision

Google Drive is connected once per workspace from Settings. Only workspace admins can start or replace the connection. The OAuth callback stores the workspace refresh token server-side and never returns it to the browser.

## Flow

1. An admin opens Settings and selects Integrations.
2. LifeHub creates a short-lived state cookie and redirects to Google with offline Drive access.
3. The callback validates the state and current LifeHub session, exchanges the code, and upserts the workspace connection.
4. Storage operations resolve the active workspace connection and use its OAuth client.
5. Workspaces without a connection receive a clear connect-from-Settings error.

## Compatibility

The service-account adapter remains available as a fallback for existing callers, but workspace-bound file and avatar flows use OAuth after connection.

{{if .plugins.design -}}
import { expect } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import DesignPage from '@/design';

export async function opensTheDesignPage(): Promise<void> {
  await render(<DesignPage />);
}

export async function seesTheStartingPoint(): Promise<void> {
  await expect.element(page.getByText('A starting point for your design.')).toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Primary action' })).toBeVisible();
}
{{- end}}

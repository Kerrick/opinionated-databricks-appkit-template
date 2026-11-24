{{if .plugins.genie -}}
import { expect } from 'vitest';
import { page } from 'vitest/browser';
import { openTheApp } from './app';

export async function opensTheGeniePage(): Promise<void> {
  await openTheApp(1280, '/genie');
}

export async function isToldWhatGenieIsFor(): Promise<void> {
  await expect.element(page.getByRole('heading', { level: 1, name: 'Genie' })).toBeVisible();
  await expect.element(page.getByText('Ask questions about your data using Databricks AI/BI Genie.')).toBeVisible();
}

export async function canTypeAQuestion(): Promise<void> {
  await expect.element(page.getByPlaceholder('Ask a question...')).toBeVisible();
}
{{- end}}

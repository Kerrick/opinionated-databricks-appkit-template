import { describe, expect, test } from 'vitest';
import { editedFilePath, isLintable } from './oxlint-edited-file.ts';

describe('editedFilePath', () => {
  test('reads the file path from an editor hook payload', () => {
    expect(editedFilePath('{"tool_name":"Edit","tool_input":{"file_path":"/p/client/src/App.tsx"}}')).toBe(
      '/p/client/src/App.tsx'
    );
  });

  test.each([
    ['not JSON', 'nope'],
    ['no tool input', '{}'],
    ['a tool input without a path', '{"tool_input":{}}'],
    ['a path that is not text', '{"tool_input":{"file_path":3}}'],
    ['a payload that is not an object', '3'],
    ['a tool input that is not an object', '{"tool_input":"x"}'],
  ])('finds nothing in %s', (_name, input) => {
    expect(editedFilePath(input)).toBeUndefined();
  });
});

describe('isLintable', () => {
  test.each(['a.ts', 'a.tsx', 'a.js', 'a.jsx', 'a.mjs', 'a.cts', 'client/src/App.tsx'])('lints %s', (path) => {
    expect(isLintable(path)).toBe(true);
  });

  test.each(['README.md', 'a.json', 'node_modules/x/index.js', 'dist/server.js', 'client\\dist\\a.js', 'a.d.css'])(
    'skips %s',
    (path) => {
      expect(isLintable(path)).toBe(false);
    }
  );
});

import { test as property } from '@fast-check/vitest';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  test('joins class names, skipping the ones that are off', () => {
    expect(cn('p-2', false, undefined, ['m-1', { hidden: true, flex: false }])).toBe('p-2 m-1 hidden');
  });

  test('lets a later Tailwind utility win over an earlier one that conflicts with it', () => {
    expect(cn('p-2 text-sm', 'p-4')).toBe('text-sm p-4');
  });

  const className = fc.constantFrom('p-2', 'p-4', 'px-1', 'm-1', 'flex', 'hidden', 'text-sm', 'text-lg', 'font-bold');

  property.prop([fc.array(className)])('merging an already merged list changes nothing', (classes) => {
    const once = cn(classes);

    expect(cn(once)).toBe(once);
  });

  property.prop([fc.array(className), className])('a class listed last is always kept', (before, last) => {
    expect(cn(before, last).split(' ')).toContain(last);
  });
});

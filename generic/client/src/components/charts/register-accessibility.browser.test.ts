import { init } from 'echarts/core';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { registerChartAccessibility } from './register-accessibility.ts';

// ECharts describes a chart to assistive technology only when its aria component is registered, and the
// registration is global to the copy of ECharts it is made on. This draws a real chart in a real browser.

test('a chart is an image described by its title once accessibility support is registered', async () => {
  registerChartAccessibility();
  const host = document.body.appendChild(document.createElement('div'));
  const chart = init(host, undefined, { renderer: 'svg', width: 300, height: 200 });
  chart.setOption({
    aria: { enabled: true },
    title: { text: 'Quarterly sales' },
    xAxis: { type: 'category', data: ['Mon', 'Tue'] },
    yAxis: {},
    series: [{ type: 'bar', data: [3, 5] }],
  });
  await expect.element(page.getByRole('img', { name: /Quarterly sales/ })).toBeInTheDocument();
  chart.dispose();
});

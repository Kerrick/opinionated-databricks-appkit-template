import { AriaComponent } from 'echarts/components';
// Renamed because React's lint rules take any function called `use` for a hook.
import { use as registerInEcharts } from 'echarts/core';

/**
 * Turns on ECharts' accessibility support for every chart in the app. Call it once, at startup.
 *
 * ECharts keeps what is registered in the copy of the library that was imported, and AppKit's charts import the one
 * that `@databricks/appkit-ui` depends on. The `echarts` this app pins to the same version is that copy, so one
 * registration reaches them all. A chart still has to ask for the description with `aria: { enabled: true }`.
 */
export function registerChartAccessibility(): void {
  registerInEcharts(AriaComponent);
}

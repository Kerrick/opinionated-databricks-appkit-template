// The step definitions every page-level scenario can use, then those that belong to a plugin the project
// selected. A plugin's file only exists when the plugin was chosen, so the glob finds what is there.
import './pages.steps';

import.meta.glob('./plugins/*.steps.{ts,tsx}', { eager: true });

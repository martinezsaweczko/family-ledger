// Only the ECharts modules the dashboard uses, so the bundle stays small.
import { init, use } from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
	GridComponent,
	LegendComponent,
	TitleComponent,
	TooltipComponent
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([
	BarChart,
	LineChart,
	PieChart,
	GridComponent,
	LegendComponent,
	TitleComponent,
	TooltipComponent,
	SVGRenderer
]);

export { init };
export type { EChartsType } from 'echarts/core';

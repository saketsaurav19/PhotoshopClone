import type { ToolModule } from './types';
import { selectionTools } from './selections';
import { paintingTools } from './paintingTools';
import { transformTools } from './transformTools';
import { utilityTools } from './utilityTools';
import { healingTools } from './healingTools';

const allTools: ToolModule[] = [
  ...selectionTools,
  ...paintingTools,
  ...transformTools,
  ...utilityTools,
  ...healingTools,
];

export const getToolModule = (id: string) => allTools.find(t => t.id === id);

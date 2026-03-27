const fs = require('fs');

const targetFile = 'c:\\Users\\Admin\\Desktop\\Sprintdebug\\sprint-relay\\src\\components\\dashboard\\DailyMeetingView.tsx';
const content = fs.readFileSync(targetFile, 'utf8');

const startStr = 'interface TaskCategory {';
const endStr = 'interface AllPersonsViewProps {';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    
    const newImports = `import { TaskCategory, CategoryFilterKey, DEFAULT_CATEGORY_FILTER, PersonMeetingData } from './daily-meeting/types';
import { computePersonMeetingData, getVisibleTaskCount, priorityDotColor, statusBadge, formatCorporateName, ACTIVE_STATUSES, formatTodoListForDM, formatTodoListForWebhook, sendTodoListToWebhook, getLatestMeetingNote } from './daily-meeting/utils';
import { PersonSingleView } from './daily-meeting/PersonSingleView';
import { HistoricalView } from './daily-meeting/HistoricalView';
import { CompareView } from './daily-meeting/CompareView';
import { DraggableTaskCard } from './daily-meeting/DraggableTaskCard';
`;

    fs.writeFileSync(targetFile, before + newImports + '\n' + after);
    console.log('Successfully refactored DailyMeetingView.tsx');
} else {
    console.error('Could not find start or end markers. startIndex:', startIndex, 'endIndex:', endIndex);
    process.exit(1);
}

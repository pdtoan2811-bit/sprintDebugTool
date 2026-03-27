const fs = require('fs');

const targetFile = 'c:\\Users\\Admin\\Desktop\\Sprintdebug\\sprint-relay\\src\\components\\dashboard\\NextSprintPlanningView.tsx';
const content = fs.readFileSync(targetFile, 'utf8');

const startStr = "type SyncTaskStatus = 'pending' | 'sending' | 'success' | 'failed';";
const endStr = 'interface NextSprintPlanningViewProps {';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    
    const newImports = `import { SyncProgress } from './next-sprint/types';
import { ACTIVE_STATUSES, priorityDotColor, statusBadge } from './next-sprint/utils';

`;

    fs.writeFileSync(targetFile, before + newImports + after);
    console.log('Successfully refactored NextSprintPlanningView.tsx');
} else {
    console.error('Could not find start or end markers. startIndex:', startIndex, 'endIndex:', endIndex);
    process.exit(1);
}

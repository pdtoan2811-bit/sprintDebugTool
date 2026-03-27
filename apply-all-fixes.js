const fs = require('fs');
let content = fs.readFileSync('src/components/dashboard/NextSprintPlanningView.tsx', 'utf8');

const typesStart = "type SyncTaskStatus = 'pending' | 'sending' | 'success' | 'failed';";
const typesEnd = "interface NextSprintPlanningViewProps {";

let startIdx = content.indexOf(typesStart);
let endIdx = content.indexOf(typesEnd);
if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + 
      `import { SyncProgress } from './next-sprint/types';\nimport { ACTIVE_STATUSES, priorityDotColor, statusBadge } from './next-sprint/utils';\n\n` + 
      content.substring(endIdx);
} else {
    console.error("Failed to find types");
}

const utilsStart = "const ACTIVE_STATUSES = new Set(['In Process', 'Bug Fixing', 'Testing', 'Reviewing']);";
const utilsEnd = "export function NextSprintPlanningView({";

startIdx = content.indexOf(utilsStart);
endIdx = content.indexOf(utilsEnd);
if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + content.substring(endIdx);
} else {
    console.error("Failed to find utils");
}

const anchor = "if (t.currentStatus !== 'Completed' && t.currentStatus !== 'Staging Passed') {";
const injection = "if (t.currentStatus !== 'Completed' && t.currentStatus !== 'Staging Passed') {\n                if (activeSprint && String(t.sprint) !== String(activeSprint)) return;";
if (content.includes(anchor)) {
    content = content.replace(anchor, injection);
} else {
    console.error("Failed to find anchor");
}

fs.writeFileSync('src/components/dashboard/NextSprintPlanningView.tsx', content);
console.log("Success");

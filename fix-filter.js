const fs = require('fs');
let content = fs.readFileSync('src/components/dashboard/NextSprintPlanningView.tsx', 'utf8');

const anchor = "if (t.currentStatus !== 'Completed' && t.currentStatus !== 'Staging Passed') {";
const injection = `
                if (activeSprint && String(t.sprint) !== String(activeSprint)) return;`;

if (content.includes(anchor)) {
    // There are two occurrences of this identical line in NextSprintPlanningView.tsx?
    // Let's replace only the first one, which is inside `allUncompletedTasks = useMemo`.
    // Wait, the activeSprint filter needs to apply everywhere!
    // Let's replace all occurrences globally
    content = content.split(anchor).join(anchor + injection);
    fs.writeFileSync('src/components/dashboard/NextSprintPlanningView.tsx', content);
    console.log("Success");
} else {
    console.log("Failed to find anchor");
}

import { scheduleConfig, setScheduleMode } from './state.js'
import { refreshStudyPlan } from './app.js';

// initPartTime: Adds the button to swap between part time and regular schedules
export async function initPartTime()
{
    const partTimeButton = document.getElementById('partTimeButton');

    partTimeButton.addEventListener('click', () => {
        switchSchedule();
    });

}

// switchSchedule: Switches between the two schedule modes (called upon button click)
export function switchSchedule()
{
    
    const partTimeHeader = document.getElementById('partTimeHeader');
    const partTimeButton = document.getElementById('partTimeButton');
    const cellIDs = [];


    if (partTimeHeader.style.display == "none")
    {
        setScheduleMode('part-time');
        partTimeHeader.style.display = "table-row";
        partTimeButton.title = "Switch Schedule to Full-Time";
    } 
    else 
    {
        partTimeHeader.style.display = "none";
        setScheduleMode('full-time');
        partTimeButton.title = "Switch Schedule to Part-Time";
    }

    refreshStudyPlan();
}
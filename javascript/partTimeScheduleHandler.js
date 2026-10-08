import { scheduleConfig, setScheduleMode } from './state.js'
import { refreshStudyPlan } from './app.js';

export async function initPartTime()
{
    const partTimeButton = document.getElementById('partTimeButton');

    partTimeButton.addEventListener('click', () => {
        switchSchedule();
    });

}

export function switchSchedule()
{
    
    const partTimeHeader = document.getElementById('partTimeHeader');
    const partTimeButton = document.getElementById('partTimeButton');
    const cellIDs = [];

    const scheduleIcon = document.getElementById('scheduleIcon');


    if (partTimeHeader.style.display == "none")
    {
        setScheduleMode('part-time');
        partTimeHeader.style.display = "table-row";
        partTimeButton.title = "Switch to Full-Time Schedule";
        scheduleIcon.title = "Switch to Full-Time Schedule";
    } 
    else 
    {
        partTimeHeader.style.display = "none";
        setScheduleMode('full-time');
        partTimeButton.title = "Switch to Part-Time Schedule";
        scheduleIcon.title = " Switch to Part-Time Schedule";
    }

    refreshStudyPlan();
}
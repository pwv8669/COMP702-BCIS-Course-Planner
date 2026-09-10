import { scheduleConfig, setScheduleMode } from './state.js'
import { refreshStudyPlan } from './app.js';

export async function initPartTime()
{
    const partTimeButton = document.getElementById('partTimeButton');

    partTimeButton.addEventListener('click', () => {
        switchSchedule();
    });

}

function switchSchedule()
{
    //add a toggle that changes the icon/text so that the button displays "full-time schedule" if the study plan is set to parttime mode
    const partTimeHeader = document.getElementById('partTimeHeader');
    const cellIDs = [];


    if (partTimeHeader.style.display == "none")
    {
        setScheduleMode('part-time');
        partTimeHeader.style.display = "table-row";
       
        

}
else
{
    partTimeHeader.style.display = "none";
    setScheduleMode('full-time');
   
    }

    refreshStudyPlan();
}
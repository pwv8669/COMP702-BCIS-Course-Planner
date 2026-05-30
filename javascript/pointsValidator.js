import { state, Pathways } from './state.js'
import { PlanError } from './objects/planError.js';
import { loadPathways } from "./objects/pathway.js";
import { loadMajorMinorOptions } from "./objects/majorMinorOption.js";

const pathways = await loadPathways();
const majorMinorOptions = await loadMajorMinorOptions();
var errors = [];
class PointsSource {
    constructor() {
        this.Source = null;
        this.Points = null;
        this.Level = null;
    }
}

export async function validatePoints() 
{
    const selectedPathway = state.selectedPathway;
    const pathway = pathways[selectedPathway];

    errors = [];
    const majorPointsSources = [];
    const minorPointsSources = [];
    const electivePointsSources = [];
    const allPointsSources = [];

    if(!pathway) {
        let message = "Cannot evaluate points without a valid pathway.";
        let errorMsg = new PlanError(null, message);
        errors.push(errorMsg);
        return errors;
    }

    for (let i = 0; i < pathway.numMajors; i++){
        if(state.selectedMajors[i]){
            majorPointsSources.push(createSources(state.selectedMajors[i]));
        }
    }
    for (let i = 0; i < pathway.numMinors; i++){
        if(state.selectedMinors[i]){
            minorPointsSources.push(createSources(state.selectedMinors[i]));
        }
    }
    for (let i = 0; i < pathway.numElectives; i++){
        if(state.selectedElectives[i]){
            electivePointsSources.push(createSources(state.selectedElectives[i]));
        }
    }
    
    state.points = [0, 0, 0];
    for (const semester of state.coursePlan) // Each dimension of 2D array
    {
        for (const course of semester) // Each array
        {
            if (course != null)
            {
            }
        }
    }
    const pointsDisplay = document.getElementById('pointsDisplay');
    pointsDisplay.innerHTML =
    `<p>
    Level 5: ${state.points[0]} - Level 6: ${state.points[1]} - Level 7: ${state.points[2]}<br>
    Total: ${state.points[0]+state.points[1]+state.points[2]}/360
    </p>`;
    console.log('POINTS: '+state.points);
    return errors;
};

function createSources(majorCode)
{
    const localSources = [];
    let major = majorMinorOptions[majorCode];
    let coursearray = major.Courses;
    let coursePlan = state.coursePlan;

    for (let semester = 0; semester < coursePlan.length; semester++){
        for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
            if (!coursePlan[semester][slot]) continue;
            if (coursearray.includes(coursePlan[semester][slot].code))
            {
                const newPointSource = new PointsSource();
                newPointSource.Points = coursePlan[semester][slot].points;
                newPointSource.Level = coursePlan[semester][slot].level;
                newPointSource.Source = coursePlan[semester][slot].code;
                //console.log(`${coursePlan[semester][slot].name} Points: ${newPointSource.Points} Level: ${newPointSource.Level} Source: ${newPointSource.Source}`);
                localSources.push(newPointSource);
            }
        }
    }
    return localSources;
}
function validate(majorCode, isMajor){
    // Set minimum courses to 4, unless this is a major, in which it will be 8. 
    let minimumCourses = isMajor ? 8 : 4;

    let major = majorMinorOptions[majorCode];
    let coursearray = major.Courses;
    let coursePlan = state.coursePlan;

    let coursesPresent = 0;
    for (let semester = 0; semester < coursePlan.length; semester++){
        for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
            if (!coursePlan[semester][slot]) continue;
            if (coursearray.includes(coursePlan[semester][slot].code)) {
                coursesPresent++;
            }
        }
    }
    if (coursesPresent<minimumCourses){
        let message = `Only ${coursesPresent}/${minimumCourses} courses for ${major.Name} are selected.`;
        let errorMsg = new PlanError(null, message);
        errors.push(errorMsg);
    }
}
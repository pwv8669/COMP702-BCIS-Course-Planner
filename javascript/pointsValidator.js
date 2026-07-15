import { state, Pathways } from './state.js'
import { PlanError } from './objects/planError.js';
import { loadPathways } from "./objects/pathway.js";
import { loadMajorOptions, loadMinorOptions } from "./objects/majorMinorOption.js";

const pathways = await loadPathways();
const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();

var errors = [];
var allPointsSources = [];
class PointsSource {
    constructor() {
        this.Source = null;
        this.Points = null;
        this.Level = null;
    }
}

export function validatePoints() 
{
    const selectedPathway = state.selectedPathway;
    const pathway = pathways[selectedPathway];

    errors = [];
    allPointsSources = [];
    const corePointsSources = [];
    const majorPointsSources = [];
    const flexiblePointsSources1 = [];
    const flexiblePointsSources2 = [];

    if(!pathway || state.selectedMajors[0] == null) {
        let message = "Cannot evaluate points without a valid pathway.";
        let errorMsg = new PlanError(null, message);
        errors.push(errorMsg);
        return errors;
    }

    createSources("Core", corePointsSources);
    if (state.selectedMajors[0] == null)
    {
        let message = "Cannot evaluate points without a selected major.";
        let errorMsg = new PlanError(null, message);
        errors.push(errorMsg);
        return errors;
    }
    else createSources(state.selectedMajors[0], majorPointsSources);
    if (selectedPathway == Pathways.doubleMajors)
    {
        if (state.selectedMajors[1] == null)
        {
            let message = "Cannot evaluate points without a second selected major.";
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
            return errors;
        }
        else createSources(state.selectedMajors[1], flexiblePointsSources1);
    }
    else if (selectedPathway == Pathways.doubleMinors)
    {
        if (state.selectedMinors[0] == null || state.selectedMinors[1] == null)
        {
            let message = "Cannot evaluate points without two selected minors.";
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
            return errors;
        }
        else
        {
            createSources(state.selectedMinors[0], flexiblePointsSources1);
            createSources(state.selectedMinors[1], flexiblePointsSources2);
        }
    }
    else if (selectedPathway == Pathways.electives)
    {
        if (state.selectedMinors[0] == null || state.selectedMinors[1] == null)
        {
            let message = "Cannot evaluate points without a selected minor.";
            let errorMsg = new PlanError(null, message);
            errors.push(errorMsg);
            return errors;
        }
        else createSources(state.selectedMinors[0], flexiblePointsSources1);
    }

    state.points = 
    [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ]
    state.totalPoints = 0;
    const seen = new Set();
    allPointsSources.filter(
        src =>
        {
            if (seen.has(src.Source)) 
            {
                src.Points = 0;
                let message = `Warning: Points will not be awarded in two subjects for ${src.Source}.`;
                let errorMsg = new PlanError(src.Source, message);
                errors.push(errorMsg);
                return false;
            }
            seen.add(src.Source);
            return true;
        }
    );
    for (const p of corePointsSources)
    {
        switch (p.Level)
        {
            case 5:
                state.points[0][0] += p.Points;
                break;
            case 6:
                state.points[0][1] += p.Points;
                break;
            case 7:
                state.points[0][2] += p.Points;
                break;
        }
        state.totalPoints += p.Points;
    }
    for (const p of majorPointsSources)
    {
        switch (p.Level)
        {
            case 5:
                state.points[1][0] += p.Points;
                break;
            case 6:
                state.points[1][1] += p.Points;
                break;
            case 7:
                state.points[1][2] += p.Points;
                break;
        }
        state.totalPoints += p.Points;
    }
    for (const p of flexiblePointsSources1)
    {
        switch (p.Level)
        {
            case 5:
                state.points[2][0] += p.Points;
                break;
            case 6:
                state.points[2][1] += p.Points;
                break;
            case 7:
                state.points[2][2] += p.Points;
                break;
        }
        state.totalPoints += p.Points;
    }
    for (const p of flexiblePointsSources2)
    {
        switch (p.Level)
        {
            case 5:
                state.points[3][0] += p.Points;
                break;
            case 6:
                state.points[3][1] += p.Points;
                break;
            case 7:
                state.points[3][2] += p.Points;
                break;
        }
        state.totalPoints += p.Points;
    }
    const pointsDisplay = document.getElementById('pointsDisplay');
    pointsDisplay = '';
    pointsDisplay.innerHTML +=
    `<p>
    Core - ${state.points[0][0] + state.points[0][1] + state.points[0][2]}/120
    Major 1 - Level 5: ${state.points[1][0]} - Level 6: ${state.points[1][1]} - Level 7: ${state.points[1][2]} - [${state.points[1][0] + state.points[1][1] + state.points[1][2]}/120]
    </p>`;
    if (selectedPathway == Pathways.doubleMajors)
    {
        pointsDisplay.innerHTML +=
        `<p>
        Major 2 - Level 5: ${state.points[2][0]} - Level 6: ${state.points[2][1]} - Level 7: ${state.points[2][2]} - [${state.points[2][0] + state.points[2][1] + state.points[2][2]}/120]
        </p>`;
    }
    else if (selectedPathway == Pathways.doubleMinors)
    {
        pointsDisplay.innerHTML +=
        `<p>
        Minor 1 - Level 5: ${state.points[2][0]} - Level 6: ${state.points[2][1]} - Level 7: ${state.points[2][2]} - [${state.points[2][0] + state.points[2][1] + state.points[2][2]}/120]
        Minor 2 - Level 5: ${state.points[3][0]} - Level 6: ${state.points[3][1]} - Level 7: ${state.points[3][2]} - [${state.points[3][0] + state.points[3][1] + state.points[3][2]}/120]
        </p>`;
    }
    else if (selectedPathway == Pathways.electives)
    {
        pointsDisplay.innerHTML +=
        `<p>
        Minor 1 - Level 5: ${state.points[2][0]} - Level 6: ${state.points[2][1]} - Level 7: ${state.points[2][2]} - [${state.points[2][0] + state.points[2][1] + state.points[2][2]}/120]
        </p>`;
    }

    pointsDisplay.innerHTML +=
    `<p>
    Total: ${state.totalPoints}/360
    </p>`;
    console.log('POINTYS: '+state.points);
    return errors;
};

function createSources(majorCode, sources)
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
                allPointsSources.push(newPointSource);
                sources.push(newPointSource);
                //console.log(`${coursePlan[semester][slot].name} Points: ${newPointSource.Points} Level: ${newPointSource.Level} Source: ${newPointSource.Source}`);
            }
        }
    }
    return localSources;
}

function compareSource(source1, source2)
{
    if (source1.Source == source2.Source) return true;
    else return false;
}
import { loadPathways } from "./objects/pathway.js";
import { loadMajorOptions, loadMinorOptions } from "./objects/majorMinorOption.js";
import { state } from "./state.js";
import { PlanError } from './objects/planError.js';
import { courses } from "./app.js";

var errors = [];
var sources = [];
const pathways = await loadPathways();
const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();

class PointSource {
    constructor(data) {
        this.points = 0;
        this.level = 0;
        this.source = null;
        this.target = null;
    }
}

export function validatePoints()
{
    errors = [];
    sources = [];

    const attributionMap = new Map();
    state.attributedCourses.forEach((key, value) => {
        attributionMap.set(value, key);
    });

    const pathway = pathways[state.selectedPathway];

    if(!pathway) {
        let message = "No valid pathway is selected.";
        let id = `InvalidPathway`;
        let errorMsg = new PlanError(null, message, id);
        errors.push(errorMsg);
        return errors;
    }

    console.log(attributionMap);
    attributionMap.forEach((majorMinor, courseCode) => {
        sources.push(createPointSource(majorMinor, courseCode));
    });
    verifyMajors(
        majorOptions["Core"]
    );
    for (let i = 0; i < pathway.numMajors; i++) {
        if (state.selectedMajors[i]) {
            verifyMajors(
                majorOptions[state.selectedMajors[i]]
            );
        }
    }
    for (let i = 0; i < pathway.numMinors; i++) {
        if (state.selectedMinors[i]) {
            verifyMinors(
                minorOptions[state.selectedMinors[i]]
            );
        }
    }

    let totalPoints = 0;
    for (let semester = 0; semester < state.coursePlan.length; semester++){
        for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
            if (!state.coursePlan[semester][slot]) continue;
            totalPoints += state.coursePlan[semester][slot].points;
        }
    }
    if (totalPoints < 360)
    {
        errors.push(new PlanError(
            null,
            `Graduation criteria requires 360 points but this study plan only has ${totalPoints} (${360-totalPoints} missing).`,
            `TotalPointsBelow360`
        ));
    }
    return errors;
}

function createPointSource(majorMinor, courseCode)
{
    let pointSource = new PointSource();
    
    if (courses[courseCode]) 
    {
        pointSource.source = courseCode;
        pointSource.target = majorMinor;
        pointSource.level = courses[courseCode].level;
        pointSource.points = courses[courseCode].points;
        //console.log(pointSource);
    }
    return pointSource;
}

function verifyMajors(major)
{
    let points = 0;
    for (const source of sources)
    {
        if (source.target == major.Code)
        {
            points += source.points;
        }
    }
    if (points < 120)
    {
        errors.push(new PlanError(
            null,
            `${major.Name} requires 120 points but this study plan only has ${points} (${120-points} missing).`,
            `PointsMissingMajor-${major.Name}`
        ));
    }
}

function verifyMinors(minor)
{
    let points = 0;
    let points6 = 0;
    let points7 = 0;
    for (const source of sources)
    {
        if (source.target == minor.Code)
        {
            points += source.points;
            if (source.level == 6)
            {
                points6 += source.points;
            }
            if (source.level == 7)
            {
                points7 += source.points;
            }
        }
    }
    if (points < 60)
    {
        errors.push(new PlanError(
            null,
            `${minor.Name} requires 60 points but this study plan only has ${points} (${60-points} missing).`,
            `PointsMissingMinor-${minor.Name}`
        ));
    }
    if (points6 < 30)
    {
        errors.push(new PlanError(
            null,
            `${minor.Name} requires 30 points at level 6 but this study plan only has ${points6} (${30-points6} missing).`,
            `PointsMissingMinorL6-${minor.Name}`
        ));
    }
    if (points7 < 15)
    {
        errors.push(new PlanError(
            null,
            `${minor.Name} requires 15 points at level 7 but this course plan only has ${points7} (${15-points7} missing).`,
            `PointsMissingMinorL7-${minor.Name}`
        ));
    }
}
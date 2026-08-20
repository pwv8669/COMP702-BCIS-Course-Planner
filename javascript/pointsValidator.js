import { loadPathways } from "./objects/pathway.js";
import { loadMajorOptions, loadMinorOptions } from "./objects/majorMinorOption.js";
import { state } from "./state.js";
import { PlanError } from './objects/planError.js';
import { courses } from "./app.js";

var errors = [];
var sources = [];
var duplicateSources = [];
const coursePlanCourses = new Set();
const pathways = await loadPathways();
const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();

export function validatePoints()
{
    // Reset
    errors = [];
    sources = [];
    duplicateSources = [];
    coursePlanCourses.clear();
    for (let semester = 0; semester < state.coursePlan.length; semester++){
        for (let slot = 0; slot < state.coursePlan[semester].length; slot++){
            if (!state.coursePlan[semester][slot]) continue;
            coursePlanCourses.add(state.coursePlan[semester][slot].code);
        }
    }

    const pathway = state.selectedPathway;

    if(!pathway) {
        let message = "No valid pathway is selected, cannot validate points.";
        let id = `InvalidPathway`;
        let errorMsg = new PlanError(null, message, id);
        errors.push(errorMsg);
        return errors;
    }

    // point validation for core. core courses are removed from the coursePlanCourses during this step to stop them from being treated as electives by the assignment algorithm
    // this is why corePoints returns the amount of core points, keeping the final total accurate.
    let totalPoints = validateCorePoints();

    // total points doesnt require any attribution logic so handled here
    for (const course of coursePlanCourses)
    {
        totalPoints += courses[course].points;
    }
    if (totalPoints < 360)
    {
        errors.push(new PlanError(
            null,
            `Graduation criteria requires 360 points but this study plan only has ${totalPoints} (${360-totalPoints} missing).`,
            `TotalPointsBelow360`
        ));
    }

    if (state.selectedPathway.numMajors == 2 && state.selectedMajors[0] && state.selectedMajors[1])
    {
        assignDoubleMajor();
    }
    else if (state.selectedPathway.numMinors == 2 && state.selectedMajors[0] && state.selectedMinors[0] && state.selectedMinors[1])
    {
        assignTwoMinor();
    }
    else if (state.selectedPathway.numElectives > 0 && state.selectedMajors[0] && state.selectedMinors[0])
    {
        assignOneMinor();
    }



    return errors; 
}

function validateCorePoints()
{
    let corePoints = 0;
    const core = majorOptions.Core;
    if (!core) return;

    for (const requirement of core.Requirements) {
        for (const course of requirement.Courses) {
            if (coursePlanCourses.has(course.code)) {
                corePoints += course.points;
                coursePlanCourses.delete(course.code);
            }
        }
    }
    if (corePoints < 120)
    {
        errors.push(new PlanError(
            null,
            `Graduation criteria requires 120 points from Core papers. You have ${corePoints} (${120-corePoints} missing).`,
            `CorePointsBelow120`
        ));
    }
    return corePoints;
}


function assignDoubleMajor()
{
    
    // 120 points in each major
    let major1Remaining = 120;
    let major2Remaining = 120;

    let maxOverlapPoints = 30;
    let doubleRequiredBucket = [];
    let major1PrioBucket = [];
    let major2PrioBucket = [];
    let prioAnyBucket = [];

    const major1 = state.selectedMajors[0];
    const major2 = state.selectedMajors[1];
    
    // steps:
    
    // step 1: course that is in only one major = prio it, do this for both majors
    // step 2: course that is required in both = double required bucket
    // step 3: course that is always required in one, but a choose N requirement in the other = prioritise required, do for both majors
    // step 4: course that is choose N in both = prio any

    for (const course of coursePlanCourses)
    {
        // Step 1
        if (courseCodeFirstOnly(course, major1.Requirements, major2.Requirements))
        {
            major1Remaining -= courses[course].points;
            //console.log(`first only for `+course+` (`+major1Remaining+`)`);
        }
        else if (courseCodeFirstOnly(course, major2.Requirements, major1.Requirements))
        {
            major2Remaining -= courses[course].points;
            //console.log(`second only for `+course+` (`+major2Remaining+`)`);
        }
        // Step 2
        else if (courseCodeDoubleRequired(course, major1.Requirements, major2.Requirements))
        {
            doubleRequiredBucket.push(course);
        }
        // Step 3
        else if (courseCodeFirstReqSecondChN(course, major1.Requirements, major2.Requirements))
        {
            major1PrioBucket.push(course);
        }
        else if (courseCodeFirstReqSecondChN(course, major2.Requirements, major1.Requirements))
        {
            major2PrioBucket.push(course);
        }
        // Step 4
        else if (courseCodeDoubleChoose(course, major2.Requirements, major1.Requirements))
        {
            prioAnyBucket.push(course);
        }
    }

    // overlap points, then filter remaining to any prio bucket
    for (let i = 0; i < doubleRequiredBucket.length; i++)
    {
        let course = doubleRequiredBucket[i];
        if (maxOverlapPoints > 0)
        {
            //console.log(`double remove cause of `+course);
            major1Remaining -= courses[course].points;
            major2Remaining -= courses[course].points;
            maxOverlapPoints -= courses[course].points;
        }
        else
        {
            //console.log('shifting to elective status - to be reviewed');
            prioAnyBucket.push(course);
        }
    }

    // check overlap points, Go into major1 unless its complete, then go major2 instead
    for (let i = 0; i < major1PrioBucket.length; i++)
    {
        let course = major1PrioBucket[i];
        if (maxOverlapPoints > 0)
        {
            //console.log(`double remove cause of `+course);
            major1Remaining -= courses[course].points;
            major2Remaining -= courses[course].points;
            maxOverlapPoints -= courses[course].points;
        }
        else if (major1Remaining > 0)
        {
            //console.log(`remove `+course);
            major1Remaining -= courses[course].points;
        }
        else
        {
            //console.log(`remove `+course);
            major2Remaining -= courses[course].points;
        }
    }

    // check overlap points, Go into major2 unless its complete, then go major1 instead
    for (let i = 0; i < major2PrioBucket.length; i++)
    {
        let course = major2PrioBucket[i];
        if (maxOverlapPoints > 0)
        {
            //console.log(`double remove cause of `+course);
            major1Remaining -= courses[course].points;
            major2Remaining -= courses[course].points;
            maxOverlapPoints -= courses[course].points;
        }
        else if (major2Remaining > 0)
        {
            //console.log(`remove `+course);
            major2Remaining -= courses[course].points;
        }
        else
        {
            //console.log(`remove `+course);
            major1Remaining -= courses[course].points;
        }
    }

    // Go in whichever has more remaining
    for (let i = 0; i < prioAnyBucket.length; i++)
    {
        let course = prioAnyBucket[i];
        if (maxOverlapPoints > 0)
        {
            //console.log(`double remove cause of `+course);
            major1Remaining -= courses[course].points;
            major2Remaining -= courses[course].points;
            maxOverlapPoints -= courses[course].points;
        }
        else if (major1Remaining > major2Remaining)
        {
            //(`any bucket remove `+course);
            major1Remaining -= courses[course].points;
        }
        else
        {
            //console.log(`any bucket remove `+course);
            major2Remaining -= courses[course].points;
        }
    }

    //console.log(`Major 1 Remain:`+major1Remaining);
    //console.log(`Major 2 Remain:`+major2Remaining);

    if (major1Remaining > 0)
    {
        errors.push(new PlanError(
            null,
            `${major1.Name} requires 120 points to complete. You have ${120-major1Remaining} (${major1Remaining} missing).`,
            `Major1PointsRemaining`
        ));
    }
    if (major2Remaining > 0)
    {
        errors.push(new PlanError(
            null,
            `${major2.Name} requires 120 points to complete. You have ${120-major2Remaining} (${major2Remaining} missing).`,
            `Major2PointsRemaining`
        ));
    }
}

function assignOneMinor()
{
    // 120 points for major
    // 60 for minor
    let majorRemaining = 120;
    let minor1Remaining = 60;


    //let minorFilterBucket = [];

    const major = state.selectedMajors[0];
    const minor = state.selectedMinors[0];

    let minor1Level6 = minor.Level6PointsRequired;
    let minor1Level7 = minor.Level7PointsRequired;
    // steps:
    
    // step 1: course that is part of the major, subtract
    // step 2: exclusive to minors, go from there. level 6 and 7 requirements

    for (const course of coursePlanCourses)
    {
        // Step 1
        if (courseCodeInRequirement(course, major.Requirements))
        {
            majorRemaining -= courses[course].points;
            //console.log(`first only for `+course+` (`+major1Remaining+`)`);
        }
        else if (courseCodeFirstOnly(course, minor.Requirements, major.Requirements))
        {
            minor1Remaining -= courses[course].points;
            if (courses[course].level == 6)
            {
                minor1Level6 -= courses[course].points;
            }
            else if (courses[course].level == 7)
            {
                minor1Level7 -= courses[course].points;
            }
        }
    }

    if (majorRemaining > 0)
    {
        errors.push(new PlanError(
            null,
            `${major.Name} requires 120 points to complete. You have ${120-majorRemaining} (${majorRemaining} missing).`,
            `Major1PointsRemaining`
        ));
    }
    if (minor1Remaining > 0)
    {
        errors.push(new PlanError(
            null,
            `${minor.Name} requires 60 points to complete. You have ${60-minor1Remaining} (${minor1Remaining} missing).`,
            `Minor1PointsRemaining`
        ));
    }
    if (minor1Level6 > 0)
    {
        errors.push(new PlanError(
            null,
            `${minor.Name} requires ${minor.Level6PointsRequired} points at level 6 to complete. You have ${minor.Level6PointsRequired-minor1Level6} (${minor1Level6} missing).`,
            `Minor1Points6Remaining`
        ));
    }
    if (minor1Level7 > 0)
    {
        errors.push(new PlanError(
            null,
            `${minor.Name} requires ${minor.Level7PointsRequired} points at level 7 to complete. You have ${minor.Level7PointsRequired-minor1Level7} (${minor1Level7} missing).`,
            `Minor1Points7Remaining`
        ));
    }
}

function assignTwoMinor()
{
    // 120 points for major
    // 60 for minors
    let majorRemaining = 120;
    let minor1Remaining = 60;
    let minor2Remaining = 60;

    let minor1PrioBucket = [];
    let minor2PrioBucket = [];
    let minorNoPrioBucket = [];

    const major = state.selectedMajors[0];
    const minor1 = state.selectedMinors[0];
    const minor2 = state.selectedMinors[1];

    let minor1Level6 = minor1.Level6PointsRequired;
    let minor1Level7 = minor1.Level7PointsRequired;

    let minor2Level6 = minor2.Level6PointsRequired;
    let minor2Level7 = minor2.Level7PointsRequired;
    console.log('aaaaa');
    // steps:
    
    // step 1: course that is part of the major, subtract
    // step 2: exclusive to minors, subtract. level 6 and 7 requirements
    // step 3: prio buckets like double major
    // step 4: no prio bucket for double choose

    for (const course of coursePlanCourses)
    {
        // Step 1
        if (courseCodeInRequirement(course, major.Requirements))
        {
            majorRemaining -= courses[course].points;
            // part of major = not involved
        }
        else if (courseCodeFirstOnly(course, minor1.Requirements, minor2.Requirements))
        {
            minor1Remaining -= courses[course].points;
            if (courses[course].level == 6)
            {
                minor1Level6 -= courses[course].points;
            }
            else if (courses[course].level == 7)
            {
                minor1Level7 -= courses[course].points;
            }
        }
        else if (courseCodeFirstOnly(course, minor2.Requirements, minor1.Requirements))
        {
            minor2Remaining -= courses[course].points;
            if (courses[course].level == 6)
            {
                minor2Level6 -= courses[course].points;
            }
            else if (courses[course].level == 7)
            {
                minor2Level7 -= courses[course].points;
            }
        }
        else if (courseCodeDoubleRequired(course, minor1.Requirements, minor2.Requirements))
        {
            // required in both ??
        }
        // Step 3
        else if (courseCodeFirstReqSecondChN(course, minor1.Requirements, minor2.Requirements))
        {
            minor1PrioBucket.push(course);
        }
        else if (courseCodeFirstReqSecondChN(course, minor2.Requirements, minor1.Requirements))
        {
            minor2PrioBucket.push(course);
        }
        // Step 4
        else if (courseCodeDoubleChoose(course, minor1.Requirements, minor2.Requirements))
        {
            minorNoPrioBucket.push(course);
        }
    }

    // prio 1 first
    for (let i = 0; i < minor1PrioBucket.length; i++)
    {
        let course = minor1PrioBucket[i];
        if (minor1Remaining > 0)
        {
            minor1Remaining -= courses[course].points;
            if (courses[course].level == 6)
            {
                minor1Level6 -= courses[course].points;
            }
            else if (courses[course].level == 7)
            {
                minor1Level7 -= courses[course].points;
            }
        }
        else
        {
            minor2Remaining -= courses[course].points;
            if (courses[course].level == 6)
            {
                minor2Level6 -= courses[course].points;
            }
            else if (courses[course].level == 7)
            {
                minor2Level7 -= courses[course].points;
            }
        }
    }

    // prio 2 first
    for (let i = 0; i < minor2PrioBucket.length; i++)
    {
        let course = minor2PrioBucket[i];
        if (minor2Remaining > 0)
        {
            minor2Remaining -= courses[course].points;
            if (courses[course].level == 6)
            {
                minor2Level6 -= courses[course].points;
            }
            else if (courses[course].level == 7)
            {
                minor2Level7 -= courses[course].points;
            }
        }
        else
        {
            minor1Remaining -= courses[course].points;
            if (courses[course].level == 6)
            {
                minor1Level6 -= courses[course].points;
            }
            else if (courses[course].level == 7)
            {
                minor1Level7 -= courses[course].points;
            }
        }
    }

    // else
    for (let i = 0; i < minorNoPrioBucket.length; i++)
    {
        let course = minorNoPrioBucket[i];
        if (minor1Remaining > minor2Remaining)
        {
            minor1Remaining -= courses[course].points;
            if (courses[course].level == 6)
            {
                minor1Level6 -= courses[course].points;
            }
            else if (courses[course].level == 7)
            {
                minor1Level7 -= courses[course].points;
            }
        }
        else
        {
            minor2Remaining -= courses[course].points;
            if (courses[course].level == 6)
            {
                minor2Level6 -= courses[course].points;
            }
            else if (courses[course].level == 7)
            {
                minor2Level7 -= courses[course].points;
            }
        }
    }
    

    if (majorRemaining > 0)
    {
        errors.push(new PlanError(
            null,
            `${major.Name} requires 120 points to complete. You have ${120-majorRemaining} (${majorRemaining} missing).`,
            `Major1PointsRemaining`
        ));
    }
    if (minor1Remaining > 0)
    {
        errors.push(new PlanError(
            null,
            `${minor1.Name} requires 60 points to complete. You have ${60-minor1Remaining} (${minor1Remaining} missing).`,
            `Minor1PointsRemaining`
        ));
    }
    if (minor1Level6 > 0)
    {
        errors.push(new PlanError(
            null,
            `${minor1.Name} requires ${minor1.Level6PointsRequired} points at level 6 to complete. You have ${minor1.Level6PointsRequired-minor1Level6} (${minor1Level6} missing).`,
            `Minor1Points6Remaining`
        ));
    }
    if (minor1Level7 > 0)
    {
        errors.push(new PlanError(
            null,
            `${minor1.Name} requires ${minor1.Level7PointsRequired} points at level 7 to complete. You have ${minor1.Level7PointsRequired-minor1Level7} (${minor1Level7} missing).`,
            `Minor1Points7Remaining`
        ));
    }
    if (minor2Remaining > 0)
    {
        errors.push(new PlanError(
            null,
            `${minor2.Name} requires 60 points to complete. You have ${60-minor2Remaining} (${minor2Remaining} missing).`,
            `Minor2PointsRemaining`
        ));
    }
    if (minor2Level6 > 0)
    {
        errors.push(new PlanError(
            null,
            `${minor2.Name} requires ${minor2.Level6PointsRequired} points at level 6 to complete. You have ${minor2.Level6PointsRequired-minor2Level6} (${minor2Level6} missing).`,
            `Minor2Points6Remaining`
        ));
    }
    if (minor2Level7 > 0)
    {
        errors.push(new PlanError(
            null,
            `${minor2.Name} requires ${minor2.Level7PointsRequired} points at level 7 to complete. You have ${minor2.Level7PointsRequired-minor2Level7} (${minor2Level7} missing).`,
            `Minor2Points7Remaining`
        ));
    }
}

// Looking for if a course code appears in neither requirements
function courseCodeNeither(courseCode, requirements1, requirements2)
{
    // return false if code matches any course in the requirement, and default true
    for (const requirement of requirements1)
    {
        for (const course of requirement.Courses)
        {
            if(course.code == courseCode) return false;
        }
    }
    for (const requirement of requirements2)
    {
        for (const course of requirement.Courses)
        {
            if(course.code == courseCode) return false;
        }
    }
    return true;
}

// Looking for if a course code appears in first requirements only
function courseCodeFirstOnly(courseCode, requirements1, requirements2)
{
    // return flag. flag true in requirements 1, flag false in requirement 2
    let flag = false;
    for (const requirement of requirements1)
    {
        for (const course of requirement.Courses)
        {
            if(course.code == courseCode) flag = true;
        }
    }
    for (const requirement of requirements2)
    {
        for (const course of requirement.Courses)
        {
            if(course.code == courseCode) flag = false;
        }
    }
    return flag;
}

// Looking for if a course code appears as a hard requirement in both
function courseCodeDoubleRequired(courseCode, requirements1, requirements2)
{
    let flag1 = false;
    let flag2 = false;
    // return if both flags are true
    for (const requirement of requirements1)
    {
        if (requirement.Type !== "Required") continue;
        for (const course of requirement.Courses)
        {
            if(course.code == courseCode) flag1 = true;
        }
    }
    for (const requirement of requirements2)
    {
        if (requirement.Type !== "Required") continue;
        for (const course of requirement.Courses)
        {
            if(course.code == courseCode) flag2 = true;
        }
    }
    return flag1 && flag2;
}

// Looking for if a course code appears as a hard requirement in first, and as a ChooseN in second
function courseCodeFirstReqSecondChN(courseCode, requirements1, requirements2)
{
    let flag1 = false;
    let flag2 = false;
    // return if both flags are true
    for (const requirement of requirements1)
    {
        if (requirement.Type !== "Required") continue;
        for (const course of requirement.Courses)
        {
            if(course.code == courseCode) flag1 = true;
        }
    }
    for (const requirement of requirements2)
    {
        if (requirement.Type !== "ChooseN") continue;
        for (const course of requirement.Courses)
        {
            if(course.code == courseCode) flag2 = true;
        }
    }
    return flag1 && flag2;
}

// Looking for if a course code appears as a choose requirement in both
function courseCodeDoubleChoose(courseCode, requirements1, requirements2)
{
    let flag1 = false;
    let flag2 = false;
    // return if both flags are true
    for (const requirement of requirements1)
    {
        if (requirement.Type !== "ChooseN") continue;
        for (const course of requirement.Courses)
        {
            if(course.code == courseCode) flag1 = true;
        }
    }
    for (const requirement of requirements2)
    {
        if (requirement.Type !== "ChooseN") continue;
        for (const course of requirement.Courses)
        {
            if(course.code == courseCode) flag2 = true;
        }
    }
    return flag1 && flag2;
}

// Looking for if a course code appears in one set of requirements
function courseCodeInRequirement(courseCode, requirements)
{
    // return false if code matches any course in the requirement, and default true
    for (const requirement of requirements)
    {
        for (const course of requirement.Courses)
        {
            if(course.code == courseCode) return true;
        }
    }
    return false;
}
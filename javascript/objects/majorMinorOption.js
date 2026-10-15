import { loadCourses } from "./course.js";
const courses = await loadCourses();


// Class that holds the name, code, requirements and specific majors/minors its not able to be taken with.
export class MajorOption {
    constructor(data) {
        this.Code = data.Code;
        this.Name = data.Name;
        this.Requirements = resolveRequirements(data.Requirements, courses);
        this.IncompatibleMajors = data.IncompatibleMajors ?? [];
        this.IncompatibleMinors = data.IncompatibleMinors ?? [];
        this.IsCore = data.IsCore ?? false;
    }
}

/* 
Same as above, however it doesn't need the distinction of being core or not (core is a major internally to make adding it easier)
This class also comes with a set amount of points required to fulfil its requirements.
*/
export class MinorOption {
    constructor(data) {
        this.Code = data.Code;
        this.Name = data.Name;
        this.Requirements = resolveRequirements(data.Requirements, courses);
        this.IncompatibleMajors = data.IncompatibleMajors ?? [];
        this.IncompatibleMinors = data.IncompatibleMinors ?? [];
        this.Level6PointsRequired = Number(data.Level6PointsRequired) ?? 30;
        this.Level7PointsRequired = Number(data.Level7PointsRequired) ?? 15;
    }
}

/* 
resolveRequirements: Takes an input requirement set and course list, and outputs a map for each given requirement and course
Inputs: requirements (Map from JSON data), courses (Map of Course objects) 
Outputs: requirements (object, key: requirement, value: map of string, Course objects)
 
See courseObjectConverter for details about Course objects
*/ 
function resolveRequirements(requirements, courses) {
    return requirements.map(req => ({
        ...req,
        Courses: req.Courses.map(code => courses[code])
    }));
}

/* 
loadMajorOptions: This loads the majors.json file and returns an object that holds all Majors in it
Inputs: N/A
Outputs: majors (object, key: courseCode string, value: MajorOption object)
 
See courseObjectConverter for details about Course objects
*/ 
export async function loadMajorOptions() {
    const response = await fetch("json/majors.json");
    const data = await response.json();
    let optionsarray = Object.values(data);
    //console.log(optionsarray);
    
    const majors = Object.fromEntries(
        Object.entries(data).map(([code, option]) => [
            code,
            new MajorOption(option)
        ])
    )   

    return majors;
}

/* 
loadMinorOptions: This loads the minors.json file and returns an object that holds all Minors in it
Inputs: N/A
Outputs: minors (object, key: courseCode string, value: MinorObject object)
 
See courseObjectConverter for details about Course objects
*/ 
export async function loadMinorOptions() {
    const response = await fetch("json/minors.json");
    const data = await response.json();

    const minors = Object.fromEntries(
        Object.entries(data).map(([code, option]) => [
            code,
            new MinorOption(option)
        ])
    )   

    return minors;
}

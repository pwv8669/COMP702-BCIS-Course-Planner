import { loadCourses } from "../courseObjectConverter.js";
const courses = await loadCourses();

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

function resolveRequirements(requirements, courses) {
    return requirements.map(req => ({
        ...req,
        Courses: req.Courses.map(code => courses[code])
    }));
}

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

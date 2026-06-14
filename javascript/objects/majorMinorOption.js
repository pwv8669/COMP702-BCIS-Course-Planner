export class MajorOption {
    constructor(data) {
        this.Code = data.Code;
        this.Name = data.Name;
        this.Requirements = data.Requirements;
        this.AlternativeRequirements = data.AlternativeRequirements ?? null;
        this.IsCore = data.IsCore;
    }
}

export class MinorOption {
    constructor(data) {
        this.Code = data.Code;
        this.Name = data.Name;
        this.Requirements = data.Requirements;
    }
}

export async function loadMajorOptions() {
    const response = await fetch("json/majors.json");
    const data = await response.json();

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
            new MajorOption(option)
        ])
    )   

    return minors;
}
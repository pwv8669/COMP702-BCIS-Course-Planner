export class MajorMinorOption {
    constructor(data) {
        this.Code = data.Code;
        this.Name = data.Name;
        this.Courses = data.Courses;
        this.AvailableAsMajor = data.AvailableAsMajor;
        this.AvailableAsMinor = data.AvailableAsMinor;
    }
}

export async function loadMajorMinorOptions() {
    const response = await fetch("json/options.json");
    const data = await response.json();

    const majors = Object.fromEntries(
        Object.entries(data).map(
            ([code, data]) => [
                code,
                new MajorMinorOption(data)
            ]
        )
    )   

    return majors;
}
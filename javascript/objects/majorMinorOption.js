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
        data.Options.map(option => [
            option.Code,
            new MajorMinorOption(option)
        ])
    )   

    return majors;
}
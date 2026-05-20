export class Pathway {
    constructor(data) {
        this.numMajors = Number(data.numMajors);
        this.numMinors = Number(data.numMinors);
        this.numElectives = Number(data.numElectives);
    }
}

export async function loadPathways() {
    const response = await fetch("json/pathways.json");
    const data = await response.json();

    const pathways = Object.fromEntries(
        Object.entries(data).map(
            ([name, pathwayData]) => [
                name,
                new Pathway(pathwayData)
            ]
        )
    )   

    return pathways;
}
//This is just a class that holds the pathway the user currently has selected.
export class Pathway {
    constructor(data) {
        this.name = data.name;
        this.numMajors = Number(data.numMajors);
        this.numMinors = Number(data.numMinors);
        this.numElectives = Number(data.numElectives);
    }
}

//Load Pathways: This function loads the available pathways from pathways.json and returns it as an object containing each entry.
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
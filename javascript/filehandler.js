import { placeCourse, PathwayRefresh } from "./app.js";
import { renderCoursePlan } from "./renderCoursePlan.js";
import { state, scheduleConfig } from "./state.js";
import { renderIgnoredErrors } from "./errorDisplay.js";
import { switchSchedule } from "./partTimeScheduleHandler.js"
import {
    loadMajorOptions,
    loadMinorOptions
} from "./objects/majorMinorOption.js";

const majorOptions = await loadMajorOptions();
const minorOptions = await loadMinorOptions();
//Init: Sets up the button that calls the savefile one click
function init() {
    const button = document.getElementById("SaveFileButton");
    button?.addEventListener("click", SaveFile, false);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
    init();
}

// getCode: Gets the given code of the input
// Input: Value that you want the code of 
// Output: Null if unable to find it or a stringified version of an object's code 
export function getCode(value) {
    const code = typeof value === "object" && value !== null
        ? value.Code ?? value.code
        : value;

    if (
        code === null ||
        code === undefined ||
        code === "" ||
        code === "null" ||
        code === "undefined"
    ) {
        return null;
    }

    return String(code);
}

function resolveSelections(values, options, size, allowedCount, type) {
    const input = Array.isArray(values) ? values : [];

    return Array.from({ length: size }, (_, index) => {
        if (index >= allowedCount) return null;

        const code = getCode(input[index]);
        if (!code) return null;

        const option = options[code];
        if (!option) {
            throw new Error(`Unknown ${type} code: ${code}`);
        }

        return option;
    });
}
// loadSchedule: Loads a schedule from a given input
// Input: Schedule from a file
// Output: Sets state to the one provided in the file
function loadSchedule(schedule) {
    if (!Array.isArray(schedule)) {
        throw new Error("The file does not contain a valid schedule.");
    }

    for (let semester = 0; semester < state.coursePlan.length; semester++) {
        const importedSemester = Array.isArray(schedule[semester])
            ? schedule[semester]
            : [];

        for (let slot = 0; slot < state.coursePlan[semester].length; slot++) {
            const courseCode = getCode(importedSemester[slot]);
            state.coursePlan[semester][slot] = null;

            if (!courseCode) continue;

            placeCourse(semester, slot, courseCode);

            if (!state.coursePlan[semester][slot]) {
                console.warn(`Unknown course code in imported file: ${courseCode}`);
            }
        }
    }
}

// importschedule: Main function for loading in the saved json schedule file
// Input: Json file
// Output: A page with the choices and schedule of the json file loaded
export function importschedule(jsonInput) {
    if (!jsonInput || typeof jsonInput !== "object") {
        throw new Error("The imported file must contain a JSON object.");
    }

    const pathwayCode = getCode(jsonInput.selectedPathway);
    const pathwaySelect = document.getElementById("pathwaySelect");

    if (
        !pathwayCode ||
        !pathwaySelect ||
        !Array.from(pathwaySelect.options).some(
            option => option.value === pathwayCode
        )
    ) {
        throw new Error(`Unknown pathway code: ${pathwayCode ?? "missing"}`);
    }

    pathwaySelect.value = pathwayCode;
    PathwayRefresh(pathwayCode);

    const pathway = state.selectedPathway;
    if (!pathway || typeof pathway.numMajors !== "number") {
        throw new Error(`Could not load pathway: ${pathwayCode}`);
    }

    state.selectedMajors = resolveSelections(
        jsonInput.selectedMajors,
        majorOptions,
        2,
        pathway.numMajors,
        "major"
    );
    state.selectedMinors = resolveSelections(
        jsonInput.selectedMinors,
        minorOptions,
        2,
        pathway.numMinors,
        "minor"
    );

    const importedElectives = Array.isArray(jsonInput.selectedElectives)
        ? jsonInput.selectedElectives
        : [];
    state.selectedElectives = Array.from({ length: 4 }, (_, index) =>
        index < pathway.numElectives
            ? getCode(importedElectives[index])
            : null
    );

    const modeType = jsonInput.mode;

    if ( scheduleConfig.mode !== modeType )
    {
        switchSchedule();
    }

    loadSchedule(jsonInput.schedule);

    state.ignoredErrors = (
        jsonInput.ignoredErrors &&
        typeof jsonInput.ignoredErrors === "object"
    )
        ? jsonInput.ignoredErrors
        : {};

    // Rebuild the controls after resolving file codes into state objects.
    PathwayRefresh(pathwayCode);
    renderIgnoredErrors();
    renderCoursePlan(state);

    return true;
}

// getSelectedPathwayCode: Get the code of a selected pathway from pathway select.
export function getSelectedPathwayCode() {
    const selectedValue = document.getElementById("pathwaySelect")?.value;
    if (selectedValue) return selectedValue;

    if (typeof state.selectedPathway === "string") {
        return state.selectedPathway;
    }

    return null;
}

// SaveFile: Save state objects as their stable JSON codes rather than "[object Object]".
export function SaveFile() {
    const payload = {
        selectedPathway: getSelectedPathwayCode(),
        selectedMajors: state.selectedMajors.map(getCode),
        selectedMinors: state.selectedMinors.map(getCode),
        selectedElectives: state.selectedElectives.map(getCode),
        schedule: state.coursePlan.map(semester =>
            semester.map(course => getCode(course))
        ),
        mode: scheduleConfig.mode,
        ignoredErrors: state.ignoredErrors ?? {}
    };

    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.download = "Schedule.json";
    link.href = url;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 0);
}

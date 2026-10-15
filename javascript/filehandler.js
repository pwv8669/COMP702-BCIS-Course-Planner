import { placeCourse, pathwayRefresh } from "./app.js";
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

/*
init: Sets up the saveFileButton.
Inputs: N/A
Outputs: N/A
*/
function init() {
    const button = document.getElementById("saveFileButton");
    button?.addEventListener("click", saveFile, false);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
    init();
}

/*
getCode: Tries to get the code from an input value.
Inputs: value (any)
Outputs: code (string), or null.

Intended for objects with code properties, or for strings that are already codes.
Course codes, Major or minor codes are examples.
*/
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

/*
resolveSelections: Tries to resolve input values into a MajorOption or MinorOption object based on the inputs.
Inputs: values (array), options (Map of MajorOption or MinorOption objects), size (number), allowedCount (number), type (string)
Outputs: option (MajorOption or MinorOption object), or null.
*/
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

/*
loadSchedule: Loads a schedule from an input array into the state.
Inputs: schedule (2D array of course codes)
Outputs: N/A

Used for schedule file import.
*/
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

/*
importSchedule: Main function for loading in the saved json schedule file
Inputs: jsonInput (object)
Outputs: true if successful, throws an error if not.

Used for schedule file import.
*/
export function importSchedule(jsonInput) {
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
    pathwayRefresh(pathwayCode);

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
    pathwayRefresh(pathwayCode);
    renderIgnoredErrors();
    renderCoursePlan(state);

    return true;
}

// getSelectedPathwayCode: Helper function to get the code of a selected pathway. Else null.
export function getSelectedPathwayCode() {
    const selectedValue = document.getElementById("pathwaySelect")?.value;
    if (selectedValue) return selectedValue;

    if (typeof state.selectedPathway === "string") {
        return state.selectedPathway;
    }

    return null;
}

/*
saveFile: Convert state objects to JSON codes rather than "[object Object]".
Inputs: N/A
Outputs: N/A

Downloads the JSON file containing the schedule.
*/
export function saveFile() {
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

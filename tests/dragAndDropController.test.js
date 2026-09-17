import {
    beforeEach,
    describe,
    expect,
    test,
    vi
} from "vitest";

// Prevent app.js from initializing when the controller is imported.
vi.mock("../javascript/app.js", () => ({
    courses: {}
}));

import {
    mapCoursePlanToDom,
    mapDomToCoursePlan
} from "../javascript/dragAndDropController.js";
import {
    setScheduleMode
} from "../javascript/state.js";

describe("drag-and-drop coordinate mapping", () => {
    beforeEach(() => {
        setScheduleMode("full-time");
    });

    test("maps full-time DOM coordinates directly", () => {
        expect(mapDomToCoursePlan(2, 3)).toEqual({
            semesterIndex: 2,
            slotIndex: 3
        });

        expect(mapCoursePlanToDom(2, 3)).toEqual({
            UIRow: 2,
            UICol: 3
        });
    });

    test("maps the right side of a part-time table", () => {
        setScheduleMode("part-time");

        expect(mapDomToCoursePlan(0, 2)).toEqual({
            semesterIndex: 6,
            slotIndex: 0
        });

        expect(mapDomToCoursePlan(5, 3)).toEqual({
            semesterIndex: 11,
            slotIndex: 1
        });
    });

    test("maps part-time plan coordinates back to the DOM", () => {
        setScheduleMode("part-time");

        expect(mapCoursePlanToDom(6, 0)).toEqual({
            UIRow: 0,
            UICol: 2
        });

        expect(mapCoursePlanToDom(11, 1)).toEqual({
            UIRow: 5,
            UICol: 3
        });
    });
});
// Unit tests for schedule configuration, plan construction, and UI mappings.

import { beforeEach, describe, expect, test } from "vitest";
import {
    buildCoursePlan,
    mapCoursePlanToDom,
    mapDomToCoursePlan,
    scheduleConfig,
    setScheduleMode,
    state
} from "../javascript/state.js";

describe("state and schedule configuration", () => {
    // Start each test with the application's standard full-time configuration.
    beforeEach(() => {
        setScheduleMode("full-time");
    });

    // A full-time degree contains six semesters with four available slots each.
    test("builds a 6 by 4 full-time course plan", () => {
        const plan = buildCoursePlan();

        expect(scheduleConfig).toEqual({
            mode: "full-time",
            semesters: 6,
            slotsPerSemester: 4
        });
        expect(plan).toHaveLength(6);
        expect(plan.every(semester => semester.length === 4)).toBe(true);
        expect(plan.flat().every(course => course === null)).toBe(true);
    });

    // Semester rows must be separate arrays so one edit cannot alter another.
    test("creates independent semester arrays", () => {
        const plan = buildCoursePlan();
        const course = { code: "COMP500" };

        plan[0][0] = course;

        expect(plan[0][0]).toBe(course);
        expect(plan[1][0]).toBeNull();
        expect(plan[0]).not.toBe(plan[1]);
    });

    // Part-time mode doubles the semesters and halves slots per semester.
    test("builds a 12 by 2 part-time course plan", () => {
        setScheduleMode("part-time");

        expect(scheduleConfig).toEqual({
            mode: "part-time",
            semesters: 12,
            slotsPerSemester: 2
        });
        expect(state.coursePlan).toHaveLength(12);
        expect(
            state.coursePlan.every(semester => semester.length === 2)
        ).toBe(true);
        expect(
            state.coursePlan.flat().every(course => course === null)
        ).toBe(true);
    });

    // Changing schedule mode intentionally replaces and clears the old plan.
    test("rebuilds the course plan when schedule mode changes", () => {
        const originalPlan = state.coursePlan;
        state.coursePlan[0][0] = { code: "COMP500" };

        setScheduleMode("part-time");

        expect(state.coursePlan).not.toBe(originalPlan);
        expect(state.coursePlan[0][0]).toBeNull();
        expect(state.coursePlan).toHaveLength(12);

        setScheduleMode("full-time");

        expect(state.coursePlan).toHaveLength(6);
        expect(state.coursePlan[0][0]).toBeNull();
    });
});

describe("course-plan coordinate mapping", () => {
    // Reset mapping behaviour to full-time before each scenario.
    beforeEach(() => {
        setScheduleMode("full-time");
    });

    // Full-time UI coordinates correspond directly to logical plan positions.
    test("maps full-time coordinates directly in both directions", () => {
        expect(mapDomToCoursePlan(2, 3)).toEqual({
            semesterIndex: 2,
            slotIndex: 3
        });
        expect(mapCoursePlanToDom(2, 3)).toEqual({
            UIRow: 2,
            UICol: 3
        });
    });

    // The left half of the part-time UI represents semesters one through six.
    test("maps the left half of the part-time grid", () => {
        setScheduleMode("part-time");

        expect(mapDomToCoursePlan(0, 0)).toEqual({
            semesterIndex: 0,
            slotIndex: 0
        });
        expect(mapDomToCoursePlan(5, 1)).toEqual({
            semesterIndex: 5,
            slotIndex: 1
        });
        expect(mapCoursePlanToDom(5, 1)).toEqual({
            UIRow: 5,
            UICol: 1
        });
    });

    // The right half of the part-time UI represents semesters seven to twelve.
    test("maps the right half of the part-time grid", () => {
        setScheduleMode("part-time");

        expect(mapDomToCoursePlan(0, 2)).toEqual({
            semesterIndex: 6,
            slotIndex: 0
        });
        expect(mapDomToCoursePlan(5, 3)).toEqual({
            semesterIndex: 11,
            slotIndex: 1
        });
        expect(mapCoursePlanToDom(6, 0)).toEqual({
            UIRow: 0,
            UICol: 2
        });
        expect(mapCoursePlanToDom(11, 1)).toEqual({
            UIRow: 5,
            UICol: 3
        });
    });

    // Every valid logical part-time position should survive a round trip.
    test("round-trips every part-time plan position through the UI", () => {
        setScheduleMode("part-time");

        for (let semester = 0; semester < 12; semester++) {
            for (let slot = 0; slot < 2; slot++) {
                const domPosition = mapCoursePlanToDom(semester, slot);
                const planPosition = mapDomToCoursePlan(
                    domPosition.UIRow,
                    domPosition.UICol
                );

                expect(planPosition).toEqual({
                    semesterIndex: semester,
                    slotIndex: slot
                });
            }
        }
    });
});

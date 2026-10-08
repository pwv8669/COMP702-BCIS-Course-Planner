// Unit tests for validation error objects and their schedule positions.

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test
} from "vitest";
import {
    ErrorSeverity,
    PlanError
} from "../javascript/objects/planError.js";
import {
    setScheduleMode
} from "../javascript/state.js";

beforeEach(() => {
    setScheduleMode("full-time");
});

afterEach(() => {
    setScheduleMode("full-time");
});

describe("ErrorSeverity", () => {
    // Severity values are stable constants and cannot be reassigned accidentally.
    test("provides an immutable warning and error enum", () => {
        expect(ErrorSeverity).toEqual({
            WARNING: "warning",
            ERROR: "error"
        });
        expect(Object.isFrozen(ErrorSeverity)).toBe(true);
    });
});

describe("PlanError", () => {
    // New errors default to warnings while retaining their identifying details.
    test("constructs a warning with a blank full-time position map", () => {
        const error = new PlanError(
            "COMP600",
            "COMP600 requires COMP500.",
            "MissingPrerequisite-COMP600"
        );

        expect(error).toMatchObject({
            courseCode: "COMP600",
            message: "COMP600 requires COMP500.",
            id: "MissingPrerequisite-COMP600",
            severity: ErrorSeverity.WARNING,
            occurences: null
        });
        expect(error.positions).toHaveLength(6);
        expect(error.positions.every(row => row.length === 4)).toBe(true);
        expect(error.positions.flat().every(value => value === null)).toBe(
            true
        );
    });

    // Validators can explicitly create blocking errors instead of warnings.
    test("accepts an explicit error severity", () => {
        const error = new PlanError(
            null,
            "The plan contains a duplicate course.",
            "Duplicate-COMP500",
            ErrorSeverity.ERROR
        );

        expect(error.courseCode).toBeNull();
        expect(error.severity).toBe(ErrorSeverity.ERROR);
    });

    // Position maps follow the active schedule mode at construction time.
    test("constructs a blank part-time position map", () => {
        setScheduleMode("part-time");

        const error = new PlanError(
            "COMP700",
            "COMP700 is unavailable.",
            "Unavailable-COMP700"
        );

        expect(error.positions).toHaveLength(12);
        expect(error.positions.every(row => row.length === 2)).toBe(true);
        expect(error.positions.flat().every(value => value === null)).toBe(
            true
        );
    });

    // Position rows must be independent so marking one cannot alter another.
    test("creates independent position rows", () => {
        const error = new PlanError(
            "COMP500",
            "Example warning.",
            "Example-COMP500"
        );

        error.positions[0][0] = true;

        expect(error.positions[0][0]).toBe(true);
        expect(error.positions[1][0]).toBeNull();
        expect(error.positions[0]).not.toBe(error.positions[1]);
    });
});

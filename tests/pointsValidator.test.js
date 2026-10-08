// Unit tests for point totals calculated from attributed study-plan courses.

import { beforeEach, describe, expect, test, vi } from "vitest";

const mockData = vi.hoisted(() => ({
    courses: {}
}));

// pointsValidator imports the application course catalogue at module load time.
vi.mock("../javascript/app.js", () => ({
    courses: mockData.courses
}));

import { validatePoints } from
    "../javascript/validation/pointsValidator.js";
import { setScheduleMode, state } from "../javascript/state.js";

// Create a 15-point course and register it in the mocked course catalogue.
function makeCourse(code, overrides = {}) {
    const course = {
        code,
        points: 15,
        level: 5,
        ...overrides
    };

    mockData.courses[code] = course;
    return course;
}

// Generate a group of courses with predictable, unique codes.
function makeCourses(prefix, count, overrides = {}) {
    return Array.from(
        { length: count },
        (_, index) => makeCourse(`${prefix}${index + 1}`, overrides)
    );
}

// Attribute each course to the option code consumed by pointsValidator.
function attributeCourses(courses, optionCode) {
    for (const course of courses) {
        state.attributedCourses.set(course.code, optionCode);
    }
}

// Create the identifying fields required when validating a major or minor.
function makeOption(code, name) {
    return { Code: code, Name: name };
}

// Create and attribute the standard eight-course, 120-point core.
function setupCore(count = 8) {
    const coreCourses = makeCourses("CORE", count);
    attributeCourses(coreCourses, "Core");
    return coreCourses;
}

// Extract IDs to keep multi-error assertions readable.
const errorIds = errors => errors.map(error => error.id);

describe("validatePoints", () => {
    // Reset shared state and the mocked catalogue before every scenario.
    beforeEach(() => {
        setScheduleMode("full-time");
        state.selectedPathway = null;
        state.selectedMajors = [null, null];
        state.selectedMinors = [null, null];
        state.attributedCourses = new Map();

        for (const code of Object.keys(mockData.courses)) {
            delete mockData.courses[code];
        }
    });

    // Validation cannot interpret attributed points without a pathway.
    test("reports a missing pathway", () => {
        const errors = validatePoints();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({
            id: "InvalidPathway",
            severity: "warning"
        });
    });

    // An empty attribution map fails both core and degree-wide totals.
    test("reports missing core and total points for an empty plan", () => {
        state.selectedPathway = {
            numMajors: 0,
            numMinors: 0,
            numElectives: 0
        };

        const errors = validatePoints();

        expect(errorIds(errors)).toEqual([
            "CorePointsBelow120",
            "TotalPointsBelow360"
        ]);
        expect(errors[0].message).toContain("120 missing");
        expect(errors[1].message).toContain("360 missing");
    });

    // Eight core and sixteen other courses meet both overall thresholds.
    test("accepts a 360-point plan containing 120 core points", () => {
        setupCore();
        attributeCourses(makeCourses("OTHER", 16), "Other");
        state.selectedPathway = {
            numMajors: 0,
            numMinors: 0,
            numElectives: 0
        };

        expect(validatePoints()).toEqual([]);
    });

    // Reaching 360 overall does not compensate for a deficient core.
    test("reports a core deficit even when total points reach 360", () => {
        setupCore(7);
        attributeCourses(makeCourses("OTHER", 17), "Other");
        state.selectedPathway = {
            numMajors: 0,
            numMinors: 0,
            numElectives: 0
        };

        const errors = validatePoints();

        expect(errorIds(errors)).toEqual(["CorePointsBelow120"]);
        expect(errors[0].message).toContain("15 missing");
    });

    // A complete core still needs another 240 points for the degree total.
    test("reports a total deficit when only the core is present", () => {
        setupCore();
        state.selectedPathway = {
            numMajors: 0,
            numMinors: 0,
            numElectives: 0
        };

        const errors = validatePoints();

        expect(errorIds(errors)).toEqual(["TotalPointsBelow360"]);
        expect(errors[0].message).toContain("240 missing");
    });

    // Shared attribution should count toward both majors but once in the total.
    test("accepts two majors with 30 shared attributed points", () => {
        setupCore();
        attributeCourses(makeCourses("SHARED", 2), "MA & MB");
        attributeCourses(makeCourses("MA", 6), "MA");
        attributeCourses(makeCourses("MB", 6), "MB");
        attributeCourses(makeCourses("OTHER", 2), "Other");

        state.selectedMajors = [
            makeOption("MA", "First Major"),
            makeOption("MB", "Second Major")
        ];
        state.selectedPathway = {
            numMajors: 2,
            numMinors: 0,
            numElectives: 0
        };

        expect(validatePoints()).toEqual([]);
    });

    // A 360-point plan still fails if neither major owns enough points.
    test("reports point deficits for both incomplete majors", () => {
        setupCore();
        attributeCourses(makeCourses("OTHER", 16), "Other");
        state.selectedMajors = [
            makeOption("MA", "First Major"),
            makeOption("MB", "Second Major")
        ];
        state.selectedPathway = {
            numMajors: 2,
            numMinors: 0,
            numElectives: 0
        };

        const errors = validatePoints();

        expect(errorIds(errors)).toEqual([
            "MAPointsBelow120",
            "MBPointsBelow120"
        ]);
    });

    // The electives pathway needs 120 major, 60 minor, and 60 elective points.
    test("accepts a complete major, minor, and elective allocation", () => {
        setupCore();
        attributeCourses(makeCourses("MA", 8), "MA");
        attributeCourses(makeCourses("MI", 4), "MI");
        attributeCourses(makeCourses("ELECTIVE", 4), "Elective");

        state.selectedMajors[0] = makeOption("MA", "Major");
        state.selectedMinors[0] = makeOption("MI", "Minor");
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 1,
            numElectives: 4
        };

        expect(validatePoints()).toEqual([]);
    });

    // Missing option ownership should report all three pathway deficits.
    test("reports incomplete major, minor, and elective allocations", () => {
        setupCore();
        attributeCourses(makeCourses("OTHER", 16), "Other");
        state.selectedMajors[0] = makeOption("MA", "Major");
        state.selectedMinors[0] = makeOption("MI", "Minor");
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 1,
            numElectives: 4
        };

        const errors = validatePoints();

        expect(errorIds(errors)).toEqual([
            "MAPointsBelow120",
            "MIPointsBelow60",
            "ElectivePointsBelow60"
        ]);
    });

    // A double-minor pathway validates each option's attributed points.
    test("accepts a complete major and two complete minors", () => {
        setupCore();
        attributeCourses(makeCourses("MA", 8), "MA");
        attributeCourses(makeCourses("MIA", 4), "MIA");
        attributeCourses(makeCourses("MIB", 4), "MIB");

        state.selectedMajors[0] = makeOption("MA", "Major");
        state.selectedMinors = [
            makeOption("MIA", "First Minor"),
            makeOption("MIB", "Second Minor")
        ];
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 2,
            numElectives: 0
        };

        expect(validatePoints()).toEqual([]);
    });
});

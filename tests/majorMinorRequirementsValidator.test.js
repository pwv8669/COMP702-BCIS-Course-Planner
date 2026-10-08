// Unit tests for major/minor requirement allocation and course attribution.

import { beforeEach, describe, expect, test, vi } from "vitest";

const { majorOptions } = vi.hoisted(() => ({
    majorOptions: {
        Core: {
            Code: "Core",
            Name: "Core",
            Requirements: []
        }
    }
}));

// The validator loads core requirements when its module is imported.
vi.mock("../javascript/objects/majorMinorOption.js", () => ({
    loadMajorOptions: vi.fn(async () => majorOptions)
}));

import {
    attributedCourses,
    validateMajorMinorRequirements
} from "../javascript/validation/majorMinorRequirementsValidator.js";
import { setScheduleMode, state } from "../javascript/state.js";

// Create the minimal course shape used by allocation and overlap calculations.
function makeCourse(code, overrides = {}) {
    return {
        code,
        level: 5,
        points: 15,
        ...overrides
    };
}

// Build a requirement in which every listed course must be present.
function required(...courses) {
    return {
        Type: "Required",
        Courses: courses
    };
}

// Build a requirement in which a specified number of courses must be chosen.
function choose(count, ...courses) {
    return {
        Type: "ChooseN",
        Count: count,
        Courses: courses
    };
}

// Create a core, major, or minor option with controlled requirements.
function makeOption(code, name, requirements = []) {
    return {
        Code: code,
        Name: name,
        Requirements: requirements
    };
}

// Place courses in the standard six-semester study plan.
function placeCourses(courses) {
    courses.forEach((course, index) => {
        const semester = Math.floor(index / 4);
        const slot = index % 4;
        state.coursePlan[semester][slot] = course;
    });
}

// Extract error IDs to keep assertions for multiple errors readable.
const errorIds = errors => errors.map(error => error.id);

describe("validateMajorMinorRequirements", () => {
    // Reset application state and the mocked core before every scenario.
    beforeEach(() => {
        setScheduleMode("full-time");
        state.selectedPathway = null;
        state.selectedMajors = [null, null];
        state.selectedMinors = [null, null];
        state.attributedCourses = new Map();
        majorOptions.Core = makeOption("Core", "Core");
    });

    // A missing pathway is an error, but available core courses are still shown.
    test("reports a missing pathway and builds a partial display map", () => {
        const coreCourse = makeCourse("CORE1");
        const extraCourse = makeCourse("EXTRA1");
        majorOptions.Core = makeOption(
            "Core",
            "Core",
            [required(coreCourse)]
        );
        placeCourses([coreCourse, extraCourse]);

        const errors = validateMajorMinorRequirements();

        expect(errorIds(errors)).toEqual(["InvalidPathway"]);
        expect(errors[0].severity).toBe("error");
        expect(attributedCourses.get("CORE1")).toBe("Core");
        expect(attributedCourses.get("EXTRA1")).toBe("Elective");
        expect(state.attributedCourses).toBe(attributedCourses);
    });

    // The double-major pathway requires both selected major slots.
    test("reports each missing selected major", () => {
        state.selectedPathway = "doubleMajors";

        const errors = validateMajorMinorRequirements();

        expect(errorIds(errors)).toEqual([
            "MissingMajor-1",
            "MissingMajor-2"
        ]);
        expect(errors.every(error => error.severity === "error")).toBe(true);
    });

    // Required core courses must appear in the study plan.
    test("reports a missing required core course", () => {
        const coreCourse = makeCourse("CORE1");
        majorOptions.Core = makeOption(
            "Core",
            "Core",
            [required(coreCourse)]
        );
        state.selectedPathway = {
            numMajors: 0,
            numMinors: 0
        };

        const errors = validateMajorMinorRequirements();

        expect(errorIds(errors)).toEqual([
            "MissingCourse-CORE1-Core"
        ]);
        expect(attributedCourses.size).toBe(0);
    });

    // Choose-N requirements fail when too few eligible courses are planned.
    test("reports an unsatisfied Choose-N major requirement", () => {
        const first = makeCourse("MA1");
        const second = makeCourse("MA2");
        const third = makeCourse("MA3");
        const major = makeOption(
            "MA",
            "Major A",
            [choose(2, first, second, third)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0
        };
        state.selectedMajors[0] = major;
        placeCourses([first]);

        const errors = validateMajorMinorRequirements();

        expect(errorIds(errors)).toEqual([
            "MissingReqs-MA1-MA2-MA3-Major A-2"
        ]);
        expect(attributedCourses.get("MA1")).toBe("MA");
    });

    // Complete exclusive requirements should be attributed to the right option.
    test("attributes core, major, minor, and elective courses", () => {
        const core = [makeCourse("CORE1"), makeCourse("CORE2")];
        const majorRequired = makeCourse("MA1");
        const majorChoice1 = makeCourse("MA2");
        const majorChoice2 = makeCourse("MA3");
        const minorRequired = makeCourse("MI1");
        const minorChoice1 = makeCourse("MI2");
        const minorChoice2 = makeCourse("MI3");
        const elective = makeCourse("ELECTIVE1");

        majorOptions.Core = makeOption(
            "Core",
            "Core",
            [required(...core)]
        );
        state.selectedMajors[0] = makeOption(
            "MA",
            "Major A",
            [
                required(majorRequired),
                choose(1, majorChoice1, majorChoice2)
            ]
        );
        state.selectedMinors[0] = makeOption(
            "MI",
            "Minor A",
            [
                required(minorRequired),
                choose(1, minorChoice1, minorChoice2)
            ]
        );
        state.selectedPathway = "electives";
        placeCourses([
            ...core,
            majorRequired,
            majorChoice2,
            minorRequired,
            minorChoice1,
            elective
        ]);

        const errors = validateMajorMinorRequirements();

        expect(errors).toEqual([]);
        expect(attributedCourses).toEqual(new Map([
            ["CORE1", "Core"],
            ["CORE2", "Core"],
            ["MA1", "MA"],
            ["MA3", "MA"],
            ["MI1", "MI"],
            ["MI2", "MI"],
            ["ELECTIVE1", "Elective"]
        ]));
    });

    // A course cannot count exclusively toward both a major and a minor.
    test("reports an exclusive major/minor overlap", () => {
        const shared = makeCourse("SHARED");
        state.selectedMajors[0] = makeOption(
            "MA",
            "Major A",
            [required(shared)]
        );
        state.selectedMinors[0] = makeOption(
            "MI",
            "Minor A",
            [required(shared)]
        );
        state.selectedPathway = "electives";
        placeCourses([shared]);

        const errors = validateMajorMinorRequirements();

        expect(errorIds(errors)).toEqual([
            "ExclusiveOverlap-MI-SHARED"
        ]);
        expect(errors[0].message).toContain(
            "already attributed to Major A"
        );
        expect(attributedCourses.get("SHARED")).toBe("MA");
    });

    // A blocked required course may be replaced by planned, higher-level courses.
    test("uses higher-level courses to resolve an exclusive overlap", () => {
        const shared = makeCourse("SHARED", { level: 5 });
        const replacement1 = makeCourse("REPLACE1", { level: 6 });
        const replacement2 = makeCourse("REPLACE2", { level: 6 });

        state.selectedMajors[0] = makeOption(
            "MA",
            "Major A",
            [required(shared)]
        );
        state.selectedMinors[0] = makeOption(
            "MI",
            "Minor A",
            [
                required(shared),
                choose(1, replacement1, replacement2)
            ]
        );
        state.selectedPathway = "electives";
        placeCourses([shared, replacement1, replacement2]);

        const errors = validateMajorMinorRequirements();

        expect(errors).toEqual([]);
        expect(attributedCourses.get("SHARED")).toBe("MA");
        expect(attributedCourses.get("REPLACE1")).toBe("MI");
        expect(attributedCourses.get("REPLACE2")).toBe("MI");
    });

    // Two majors may share 30 points when matching elective points are present.
    test("accepts valid double-major overlap with compensating electives", () => {
        const shared1 = makeCourse("SHARED1");
        const shared2 = makeCourse("SHARED2");
        const majorAOnly = makeCourse("MA1");
        const majorBOnly = makeCourse("MB1");
        const electives = [makeCourse("E1"), makeCourse("E2")];

        state.selectedMajors = [
            makeOption(
                "MA",
                "Major A",
                [required(shared1, shared2, majorAOnly)]
            ),
            makeOption(
                "MB",
                "Major B",
                [required(shared1, shared2, majorBOnly)]
            )
        ];
        state.selectedPathway = "doubleMajors";
        placeCourses([
            shared1,
            shared2,
            majorAOnly,
            majorBOnly,
            ...electives
        ]);

        const errors = validateMajorMinorRequirements();

        expect(errors).toEqual([]);
        expect(attributedCourses.get("SHARED1")).toBe("MA & MB");
        expect(attributedCourses.get("SHARED2")).toBe("MA & MB");
        expect(attributedCourses.get("E1")).toBe("Elective");
        expect(attributedCourses.get("E2")).toBe("Elective");
    });

    // Each overlapping double-major course requires another 15 elective points.
    test("reports missing electives for double-major overlap", () => {
        const shared1 = makeCourse("SHARED1");
        const shared2 = makeCourse("SHARED2");
        const majorAOnly = makeCourse("MA1");
        const majorBOnly = makeCourse("MB1");
        const oneElective = makeCourse("E1");

        state.selectedMajors = [
            makeOption(
                "MA",
                "Major A",
                [required(shared1, shared2, majorAOnly)]
            ),
            makeOption(
                "MB",
                "Major B",
                [required(shared1, shared2, majorBOnly)]
            )
        ];
        state.selectedPathway = "doubleMajors";
        placeCourses([
            shared1,
            shared2,
            majorAOnly,
            majorBOnly,
            oneElective
        ]);

        const errors = validateMajorMinorRequirements();

        expect(errorIds(errors)).toEqual([
            "MissingOverlapElectives-SHARED1-SHARED2"
        ]);
        expect(errors[0].message).toContain(
            "Add 1 additional 15-point elective course"
        );
    });

    // More than two shared 15-point courses exceeds the 30-point limit.
    test("reports double-major overlap above 30 points", () => {
        const shared = [
            makeCourse("SHARED1"),
            makeCourse("SHARED2"),
            makeCourse("SHARED3")
        ];
        const majorAOnly = makeCourse("MA1");
        const majorBOnly = makeCourse("MB1");
        const electives = [
            makeCourse("E1"),
            makeCourse("E2"),
            makeCourse("E3")
        ];

        state.selectedMajors = [
            makeOption(
                "MA",
                "Major A",
                [required(...shared, majorAOnly)]
            ),
            makeOption(
                "MB",
                "Major B",
                [required(...shared, majorBOnly)]
            )
        ];
        state.selectedPathway = "doubleMajors";
        placeCourses([
            ...shared,
            majorAOnly,
            majorBOnly,
            ...electives
        ]);

        const errors = validateMajorMinorRequirements();

        expect(errorIds(errors)).toEqual([
            "DoubleMajorOverlapLimit-MA-MB"
        ]);
        expect(errors[0].message).toContain("45 points of overlap");
        expect(errors[0].severity).toBe("error");
    });
});

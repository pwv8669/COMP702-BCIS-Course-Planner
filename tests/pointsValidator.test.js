// Unit tests for graduation, major, and minor point validation.

import { beforeEach, describe, expect, test, vi } from "vitest";

const mockData = vi.hoisted(() => ({
    courses: {},
    majorOptions: {
        Core: { Name: "Core", Requirements: [] }
    },
    minorOptions: {},
    pathways: {}
}));

// pointsValidator imports the application course catalogue at module load time.
vi.mock("../javascript/app.js", () => ({
    courses: mockData.courses
}));

// Supply controlled major and minor data instead of fetching browser JSON.
vi.mock("../javascript/objects/majorMinorOption.js", () => ({
    loadMajorOptions: vi.fn(async () => mockData.majorOptions),
    loadMinorOptions: vi.fn(async () => mockData.minorOptions)
}));

// Pathways are mocked because the module loads them even though validation uses state.
vi.mock("../javascript/objects/pathway.js", () => ({
    loadPathways: vi.fn(async () => mockData.pathways)
}));

import { validatePoints } from "../javascript/pointsValidator.js";
import { setScheduleMode, state } from "../javascript/state.js";

// Create a course and register it in the catalogue used by pointsValidator.
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

// Create the requirement structure used by majors, minors, and the core.
function requiredCourses(courses) {
    return [{ Type: "Required", Courses: courses }];
}

// Build a selectable major or minor from a set of course requirements.
function makeOption(name, courses, overrides = {}) {
    return {
        Name: name,
        Requirements: requiredCourses(courses),
        ...overrides
    };
}

// Place courses into the real full-time plan in semester and slot order.
function placeCourses(courses) {
    courses.forEach((course, index) => {
        const semester = Math.floor(index / 4);
        const slot = index % 4;
        state.coursePlan[semester][slot] = course;
    });
}

// Configure and return the standard eight-course, 120-point core.
function setupCore(count = 8) {
    const coreCourses = makeCourses("CORE", count);
    mockData.majorOptions.Core = makeOption("Core", coreCourses);
    return coreCourses;
}

// Extract IDs to keep multi-error assertions readable.
const errorIds = errors => errors.map(error => error.id);

describe("validatePoints", () => {
    // Reset shared state and mocked catalogues before every validation scenario.
    beforeEach(() => {
        setScheduleMode("full-time");
        state.selectedPathway = null;
        state.selectedMajors = [null, null];
        state.selectedMinors = [null, null];

        for (const code of Object.keys(mockData.courses)) {
            delete mockData.courses[code];
        }

        mockData.majorOptions.Core = {
            Name: "Core",
            Requirements: []
        };
    });

    // Validation cannot attribute points until a pathway has been selected.
    test("reports a missing pathway", () => {
        const errors = validatePoints();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({
            id: "InvalidPathway",
            severity: "warning"
        });
    });

    // An empty plan fails both the 120-point core and 360-point degree totals.
    test("reports missing core and total points for an empty plan", () => {
        setupCore();
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

    // Eight core and sixteen other 15-point courses meet both point thresholds.
    test("accepts a 360-point plan containing 120 core points", () => {
        const coreCourses = setupCore();
        const otherCourses = makeCourses("OTHER", 16);
        placeCourses([...coreCourses, ...otherCourses]);
        state.selectedPathway = {
            numMajors: 0,
            numMinors: 0,
            numElectives: 0
        };

        expect(validatePoints()).toEqual([]);
    });

    // Reaching 360 overall does not compensate for falling short in the core.
    test("reports a core deficit even when total points reach 360", () => {
        const coreCourses = setupCore(7);
        const otherCourses = makeCourses("OTHER", 17);
        placeCourses([...coreCourses, ...otherCourses]);
        state.selectedPathway = {
            numMajors: 0,
            numMinors: 0,
            numElectives: 0
        };

        const errors = validatePoints();

        expect(errorIds(errors)).toEqual(["CorePointsBelow120"]);
        expect(errors[0].message).toContain("15 missing");
    });

    // A complete core still needs another 240 points to reach the degree total.
    test("reports a total deficit when only the core is present", () => {
        const coreCourses = setupCore();
        placeCourses(coreCourses);
        state.selectedPathway = {
            numMajors: 0,
            numMinors: 0,
            numElectives: 0
        };

        const errors = validatePoints();

        expect(errorIds(errors)).toEqual(["TotalPointsBelow360"]);
        expect(errors[0].message).toContain("240 missing");
    });

    // Double majors may share no more than 30 points between their requirements.
    test("accepts two complete majors with 30 overlapping points", () => {
        const coreCourses = setupCore();
        const sharedCourses = makeCourses("SHARED", 2);
        const firstMajorOnly = makeCourses("MAJORA", 6);
        const secondMajorOnly = makeCourses("MAJORB", 6);
        const electives = makeCourses("ELECTIVE", 2);

        state.selectedMajors = [
            makeOption(
                "First Major",
                [...sharedCourses, ...firstMajorOnly]
            ),
            makeOption(
                "Second Major",
                [...sharedCourses, ...secondMajorOnly]
            )
        ];
        state.selectedPathway = {
            numMajors: 2,
            numMinors: 0,
            numElectives: 0
        };
        placeCourses([
            ...coreCourses,
            ...sharedCourses,
            ...firstMajorOnly,
            ...secondMajorOnly,
            ...electives
        ]);

        expect(validatePoints()).toEqual([]);
    });

    // A 360-point plan still fails when neither major receives its required points.
    test("reports point deficits for both incomplete majors", () => {
        const coreCourses = setupCore();
        const unrelatedCourses = makeCourses("OTHER", 16);
        placeCourses([...coreCourses, ...unrelatedCourses]);
        state.selectedMajors = [
            makeOption("First Major", []),
            makeOption("Second Major", [])
        ];
        state.selectedPathway = {
            numMajors: 2,
            numMinors: 0,
            numElectives: 0
        };

        const errors = validatePoints();

        expect(errorIds(errors)).toEqual([
            "Major1PointsRemaining",
            "Major2PointsRemaining"
        ]);
    });

    // A single minor must meet its total plus level-6 and level-7 thresholds.
    test("accepts a complete major and single minor", () => {
        const coreCourses = setupCore();
        const majorCourses = makeCourses("MAJOR", 8);
        const minorCourses = [
            makeCourse("MINOR1", { level: 6 }),
            makeCourse("MINOR2", { level: 6 }),
            makeCourse("MINOR3", { level: 7 }),
            makeCourse("MINOR4", { level: 5 })
        ];
        const electives = makeCourses("ELECTIVE", 4);

        state.selectedMajors[0] = makeOption("Major", majorCourses);
        state.selectedMinors[0] = makeOption("Minor", minorCourses, {
            Level6PointsRequired: 30,
            Level7PointsRequired: 15
        });
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 1,
            numElectives: 4
        };
        placeCourses([
            ...coreCourses,
            ...majorCourses,
            ...minorCourses,
            ...electives
        ]);

        expect(validatePoints()).toEqual([]);
    });

    // Missing major/minor courses should report every applicable point category.
    test("reports all deficits for an incomplete major and minor", () => {
        const coreCourses = setupCore();
        const unrelatedCourses = makeCourses("OTHER", 16);
        placeCourses([...coreCourses, ...unrelatedCourses]);
        state.selectedMajors[0] = makeOption("Major", []);
        state.selectedMinors[0] = makeOption("Minor", [], {
            Level6PointsRequired: 30,
            Level7PointsRequired: 15
        });
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 1,
            numElectives: 4
        };

        const errors = validatePoints();

        expect(errorIds(errors)).toEqual([
            "Major1PointsRemaining",
            "Minor1PointsRemaining",
            "Minor1Points6Remaining",
            "Minor1Points7Remaining"
        ]);
    });

    // Double-minor pathways attribute exclusive courses to the correct option.
    test("accepts a complete major and two complete minors", () => {
        const coreCourses = setupCore();
        const majorCourses = makeCourses("MAJOR", 8);
        const firstMinorCourses = [
            makeCourse("MINORA1", { level: 6 }),
            makeCourse("MINORA2", { level: 6 }),
            makeCourse("MINORA3", { level: 7 }),
            makeCourse("MINORA4", { level: 5 })
        ];
        const secondMinorCourses = [
            makeCourse("MINORB1", { level: 6 }),
            makeCourse("MINORB2", { level: 6 }),
            makeCourse("MINORB3", { level: 7 }),
            makeCourse("MINORB4", { level: 5 })
        ];

        state.selectedMajors[0] = makeOption("Major", majorCourses);
        state.selectedMinors = [
            makeOption("First Minor", firstMinorCourses, {
                Level6PointsRequired: 30,
                Level7PointsRequired: 15
            }),
            makeOption("Second Minor", secondMinorCourses, {
                Level6PointsRequired: 30,
                Level7PointsRequired: 15
            })
        ];
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 2,
            numElectives: 0
        };
        placeCourses([
            ...coreCourses,
            ...majorCourses,
            ...firstMinorCourses,
            ...secondMinorCourses
        ]);

        expect(validatePoints()).toEqual([]);
    });
});

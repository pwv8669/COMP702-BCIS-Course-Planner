// Behaviour tests for automatic course selection and semester scheduling.

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi
} from "vitest";
import { setScheduleMode, state } from "../javascript/state.js";

const mockData = vi.hoisted(() => ({
    courses: {},
    majorOptions: {
        Core: {
            Code: "Core",
            Name: "Core",
            Requirements: []
        }
    },
    refreshStudyPlan: vi.fn(),
    alert: vi.fn(),
    button: {
        addEventListener: vi.fn()
    }
}));

// Keep generation independent of application rendering.
vi.mock("../javascript/app.js", () => ({
    refreshStudyPlan: mockData.refreshStudyPlan
}));

// Return mutable in-memory data to the module's top-level loaders.
vi.mock("../javascript/objects/course.js", () => ({
    NodeType: {
        AND: "AND",
        OR: "OR",
        COURSE: "COURSE"
    },
    loadCourses: vi.fn(async () => mockData.courses)
}));

vi.mock("../javascript/objects/majorMinorOption.js", () => ({
    loadMajorOptions: vi.fn(async () => mockData.majorOptions)
}));

let generateStudyPlan;

// Import after installing the minimal browser globals used during module setup.
beforeAll(async () => {
    vi.stubGlobal("document", {
        getElementById: vi.fn(() => mockData.button)
    });
    vi.stubGlobal("alert", mockData.alert);

    ({ generateStudyPlan } = await import(
        "../javascript/autopopulateStudyPlan.js"
    ));
});

afterAll(() => {
    vi.unstubAllGlobals();
});

// Create a schedulable course and register it in the mocked catalogue.
function makeCourse(code, overrides = {}) {
    const course = {
        code,
        name: `${code} name`,
        points: 15,
        level: 5,
        semester1Offered: true,
        semester2Offered: true,
        prerequisites: null,
        corequisites: null,
        level5PointsRequired: 0,
        level6PointsRequired: 0,
        level7PointsRequired: 0,
        mustBeTakenConsequtively: false,
        requiresAllCoreAndMajorRequirementsUpToLevel: null,
        ...overrides
    };

    mockData.courses[code] = course;
    return course;
}

// Build a requirement in which every listed course is required.
function required(...courses) {
    return {
        Type: "Required",
        Courses: courses
    };
}

// Build a requirement in which a specified number of courses is selected.
function choose(count, ...courses) {
    return {
        Type: "ChooseN",
        Count: count,
        Courses: courses
    };
}

// Create a selectable major or minor option.
function makeOption(code, requirements = []) {
    return {
        Code: code,
        Name: `${code} option`,
        Requirements: requirements
    };
}

// Create the prerequisite-tree shape consumed by the scheduler.
function courseNode(code) {
    return {
        type: "COURSE",
        value: code,
        children: []
    };
}

// Return all non-empty course codes currently committed to the plan.
function plannedCourseCodes() {
    return state.coursePlan
        .flat()
        .filter(course => course)
        .map(course => course.code);
}

// Locate the semester containing a generated course.
function findCourseSemester(code) {
    return state.coursePlan.findIndex(semester =>
        semester.some(course => course?.code === code)
    );
}

// Convert a generated plan into a stable value for deterministic comparisons.
function serialisePlan() {
    return state.coursePlan.map(semester =>
        semester.map(course => course?.code ?? null)
    );
}

describe("generateStudyPlan", () => {
    // Reset shared state and mutable loader data before every scenario.
    beforeEach(() => {
        setScheduleMode("full-time");
        state.selectedPathway = null;
        state.selectedMajors = [null, null];
        state.selectedMinors = [null, null];
        state.selectedElectives = [null, null, null, null];

        for (const code of Object.keys(mockData.courses)) {
            delete mockData.courses[code];
        }

        mockData.majorOptions.Core = makeOption("Core");
        mockData.alert.mockClear();
        mockData.refreshStudyPlan.mockClear();
    });

    // Generation requires a pathway and must not alter an existing plan.
    test("rejects generation when no pathway is selected", () => {
        const existingCourse = makeCourse("NOPATH_EXISTING");
        state.coursePlan[0][0] = existingCourse;

        const generated = generateStudyPlan();

        expect(generated).toBe(false);
        expect(mockData.alert).toHaveBeenCalledWith(
            "Please select a pathway before autopopulating the study plan."
        );
        expect(state.coursePlan[0][0]).toBe(existingCourse);
    });

    // The pathway's required number of majors must be selected first.
    test("rejects generation when a required major is missing", () => {
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        const generated = generateStudyPlan();

        expect(generated).toBe(false);
        expect(mockData.alert).toHaveBeenCalledWith(
            "Please select at least 1 major(s) for the chosen pathway."
        );
    });

    // The pathway's required number of minors must also be selected.
    test("rejects generation when a required minor is missing", () => {
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 1,
            numElectives: 0
        };
        state.selectedMajors[0] = makeOption("MISSING_MINOR_MAJOR");

        const generated = generateStudyPlan();

        expect(generated).toBe(false);
        expect(mockData.alert).toHaveBeenCalledWith(
            "Please select at least 1 minor(s) for the chosen pathway."
        );
    });

    // Required core and major courses should all be selected and committed.
    test("adds required core and major courses to the plan", () => {
        const coreCourse = makeCourse("REQ_CORE");
        const majorCourse = makeCourse("REQ_MAJOR");
        mockData.majorOptions.Core = makeOption(
            "Core",
            [required(coreCourse)]
        );
        state.selectedMajors[0] = makeOption(
            "REQ_MAJOR_OPTION",
            [required(majorCourse)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        const generated = generateStudyPlan();

        expect(generated).toBe(true);
        expect(new Set(plannedCourseCodes())).toEqual(
            new Set(["REQ_CORE", "REQ_MAJOR"])
        );
        expect(mockData.alert).not.toHaveBeenCalled();
    });

    // Choose-N requirements should add exactly the requested number of options.
    test("satisfies a Choose-N requirement", () => {
        const choices = [
            makeCourse("CHOOSE_A"),
            makeCourse("CHOOSE_B"),
            makeCourse("CHOOSE_C")
        ];
        state.selectedMajors[0] = makeOption(
            "CHOOSE_MAJOR",
            [choose(2, ...choices)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        const generated = generateStudyPlan();
        const selectedChoices = plannedCourseCodes().filter(code =>
            code.startsWith("CHOOSE_")
        );

        expect(generated).toBe(true);
        expect(selectedChoices).toHaveLength(2);
        expect(choices.map(course => course.code)).toEqual(
            expect.arrayContaining(selectedChoices)
        );
    });

    // Core Choose-N requirements must be handled like major/minor choices.
    test("satisfies required and Choose-N Core requirements", () => {
        const requiredCore = makeCourse("CORE_REQUIRED");
        const coreChoices = [
            makeCourse("CORE_CHOICE_A"),
            makeCourse("CORE_CHOICE_B"),
            makeCourse("CORE_CHOICE_C")
        ];
        mockData.majorOptions.Core = makeOption(
            "Core",
            [
                required(requiredCore),
                choose(2, ...coreChoices)
            ]
        );
        state.selectedMajors[0] = makeOption("CORE_TEST_MAJOR");
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        expect(generateStudyPlan()).toBe(true);
        expect(plannedCourseCodes()).toContain("CORE_REQUIRED");
        expect(
            plannedCourseCodes().filter(code =>
                code.startsWith("CORE_CHOICE_")
            )
        ).toHaveLength(2);
    });

    // Core courses should retain early capacity even when a major course has dependents.
    test("places six flexible Core courses in the first six slots", () => {
        const coreCourses = [
            makeCourse("COMP500"),
            makeCourse("COMP501"),
            makeCourse("COMP507"),
            makeCourse("COMP508"),
            makeCourse("DIGD507"),
            makeCourse("MATH503")
        ];
        const comp503 = makeCourse("COMP503", {
            corequisites: courseNode("COMP500")
        });
        const comp603 = makeCourse("COMP603", {
            level: 6,
            prerequisites: courseNode("COMP503")
        });
        mockData.majorOptions.Core = makeOption(
            "Core",
            [required(...coreCourses)]
        );
        state.selectedMajors[0] = makeOption(
            "PRIORITY_MAJOR",
            [required(comp503, comp603)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        expect(generateStudyPlan()).toBe(true);
        expect(
            state.coursePlan
                .flat()
                .slice(0, 6)
                .map(course => course?.code)
        ).toEqual(
            expect.arrayContaining(
                coreCourses.map(course => course.code)
            )
        );
        expect(findCourseSemester("COMP503")).toBeGreaterThanOrEqual(1);
    });

    // A prerequisite must be scheduled in an earlier semester than its course.
    test("orders prerequisites before dependent courses", () => {
        const prerequisite = makeCourse("ORDER_PRE");
        const dependent = makeCourse("ORDER_DEP", {
            level: 6,
            prerequisites: courseNode("ORDER_PRE")
        });
        state.selectedMajors[0] = makeOption(
            "ORDER_MAJOR",
            [required(prerequisite, dependent)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        const generated = generateStudyPlan();

        expect(generated).toBe(true);
        expect(findCourseSemester("ORDER_PRE")).toBeLessThan(
            findCourseSemester("ORDER_DEP")
        );
    });

    // A corequisite may be earlier or concurrent, but never later.
    test("does not schedule COMP503 before its COMP500 corequisite", () => {
        const comp500 = makeCourse("COMP500", {
            semester1Offered: false,
            semester2Offered: true
        });
        const comp503 = makeCourse("COMP503", {
            semester1Offered: true,
            semester2Offered: false,
            corequisites: courseNode("COMP500")
        });
        mockData.majorOptions.Core = makeOption(
            "Core",
            [required(comp500)]
        );
        state.selectedMajors[0] = makeOption(
            "COREQUISITE_MAJOR",
            [required(comp503)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        expect(generateStudyPlan()).toBe(true);
        expect(findCourseSemester("COMP500")).toBeLessThanOrEqual(
            findCourseSemester("COMP503")
        );
    });

    // Semester availability should constrain generated semester parity.
    test("respects semester-one and semester-two availability", () => {
        const semesterOneCourse = makeCourse("OFFER_SEM1", {
            semester1Offered: true,
            semester2Offered: false
        });
        const semesterTwoCourse = makeCourse("OFFER_SEM2", {
            semester1Offered: false,
            semester2Offered: true
        });
        state.selectedMajors[0] = makeOption(
            "OFFER_MAJOR",
            [required(semesterOneCourse, semesterTwoCourse)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        const generated = generateStudyPlan();

        expect(generated).toBe(true);
        expect(findCourseSemester("OFFER_SEM1") % 2).toBe(0);
        expect(findCourseSemester("OFFER_SEM2") % 2).toBe(1);
    });

    // Point prerequisites count only matching-level courses in earlier semesters.
    test("schedules enough earlier points for a point prerequisite", () => {
        const firstContributor = makeCourse("POINTS_A", {
            level: 5,
            points: 15
        });
        const secondContributor = makeCourse("POINTS_B", {
            level: 5,
            points: 15
        });
        const advancedCourse = makeCourse("POINTS_ADVANCED", {
            level: 6,
            level5PointsRequired: 30
        });
        state.selectedMajors[0] = makeOption(
            "POINTS_MAJOR",
            [required(firstContributor, secondContributor, advancedCourse)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        const generated = generateStudyPlan();
        const advancedSemester = findCourseSemester("POINTS_ADVANCED");

        expect(generated).toBe(true);
        expect(findCourseSemester("POINTS_A")).toBeLessThan(
            advancedSemester
        );
        expect(findCourseSemester("POINTS_B")).toBeLessThan(
            advancedSemester
        );
    });

    // Missing prerequisite courses make the selected course set unschedulable.
    test("rejects a plan with an unavailable prerequisite", () => {
        const dependent = makeCourse("IMPOSSIBLE_DEP", {
            prerequisites: courseNode("IMPOSSIBLE_MISSING")
        });
        state.selectedMajors[0] = makeOption(
            "IMPOSSIBLE_MAJOR",
            [required(dependent)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        const generated = generateStudyPlan();

        expect(generated).toBe(false);
        expect(mockData.alert).toHaveBeenCalledWith(
            "Unable to generate a valid study plan."
        );
        expect(plannedCourseCodes()).toEqual([]);
    });

    // A full-time plan cannot contain more courses than its 24 available slots.
    test("rejects a course set larger than the plan capacity", () => {
        const requiredCourses = Array.from(
            { length: 25 },
            (_, index) => makeCourse(`CAPACITY_${index + 1}`)
        );
        state.selectedMajors[0] = makeOption(
            "CAPACITY_MAJOR",
            [required(...requiredCourses)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        const generated = generateStudyPlan();

        expect(generated).toBe(false);
        expect(mockData.alert).toHaveBeenCalledWith(
            "Unable to generate a valid study plan."
        );
        expect(plannedCourseCodes()).toEqual([]);
    });

    // Real Core codes must be scheduled normally in a 12-by-2 part-time plan.
    test("generates a part-time plan containing the real Core courses", () => {
        setScheduleMode("part-time");
        const foundationalCourses = [
            makeCourse("COMP500"),
            makeCourse("COMP501"),
            makeCourse("COMP507"),
            makeCourse("COMP508"),
            makeCourse("DIGD507"),
            makeCourse("MATH503")
        ];
        const projectOne = makeCourse("COMP702", {
            level: 7,
            requiresAllCoreAndMajorRequirementsUpToLevel: 6
        });
        const projectTwo = makeCourse("COMP703", {
            level: 7,
            prerequisites: courseNode("COMP702"),
            mustBeTakenConsequtively: true
        });
        const coreCourses = [
            ...foundationalCourses,
            projectOne,
            projectTwo
        ];
        mockData.majorOptions.Core = makeOption(
            "Core",
            [required(...coreCourses)]
        );
        state.selectedMajors[0] = makeOption(
            "PART_TIME_MAJOR",
            []
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        const generated = generateStudyPlan();

        expect(generated).toBe(true);
        expect(state.coursePlan).toHaveLength(12);
        expect(
            state.coursePlan.every(semester => semester.length === 2)
        ).toBe(true);
        expect(new Set(plannedCourseCodes())).toEqual(
            new Set(coreCourses.map(course => course.code))
        );

        const projectOneSemester = findCourseSemester("COMP702");
        expect(
            foundationalCourses.every(course =>
                findCourseSemester(course.code) < projectOneSemester
            )
        ).toBe(true);
        expect(findCourseSemester("COMP703")).toBe(
            projectOneSemester + 1
        );
    });

    // Cached assignments must not be reused after the schedule mode changes.
    test("keeps full-time and part-time schedule caches separate", () => {
        const course = makeCourse("MODE_CACHE");
        state.selectedMajors[0] = makeOption(
            "MODE_CACHE_MAJOR",
            [required(course)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        setScheduleMode("part-time");
        expect(generateStudyPlan()).toBe(true);
        expect(findCourseSemester("MODE_CACHE")).toBeGreaterThan(5);

        setScheduleMode("full-time");
        expect(generateStudyPlan()).toBe(true);
        expect(findCourseSemester("MODE_CACHE")).toBeLessThan(6);
    });

    // Repeated generation with unchanged inputs should produce the same plan.
    test("produces a deterministic plan for identical input", () => {
        const prerequisite = makeCourse("DETERMINISTIC_PRE");
        const dependent = makeCourse("DETERMINISTIC_DEP", {
            prerequisites: courseNode("DETERMINISTIC_PRE")
        });
        const other = makeCourse("DETERMINISTIC_OTHER");
        state.selectedMajors[0] = makeOption(
            "DETERMINISTIC_MAJOR",
            [required(prerequisite, dependent, other)]
        );
        state.selectedPathway = {
            numMajors: 1,
            numMinors: 0,
            numElectives: 0
        };

        expect(generateStudyPlan()).toBe(true);
        const firstPlan = serialisePlan();

        expect(generateStudyPlan()).toBe(true);
        const secondPlan = serialisePlan();

        expect(secondPlan).toEqual(firstPlan);
    });
});

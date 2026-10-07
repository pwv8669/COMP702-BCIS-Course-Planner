// Unit tests for importing and exporting study-plan JSON files.

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi
} from "vitest";
import {
    scheduleConfig,
    setScheduleMode,
    state
} from "../javascript/state.js";

const mockData = vi.hoisted(() => ({
    courses: {
        COMP500: { code: "COMP500", name: "Programming Concepts" },
        COMP600: { code: "COMP600", name: "Advanced Computing" },
        COMP700: { code: "COMP700", name: "Project" },
        COMP701: { code: "COMP701", name: "Advanced Project" }
    },
    majorOptions: {
        MajorA: { Code: "MajorA", Name: "Major A" },
        MajorB: { Code: "MajorB", Name: "Major B" }
    },
    minorOptions: {
        MinorA: { Code: "MinorA", Name: "Minor A" },
        MinorB: { Code: "MinorB", Name: "Minor B" }
    },
    pathways: {
        doubleMajors: {
            name: "Double Majors",
            numMajors: 2,
            numMinors: 0,
            numElectives: 0
        },
        electives: {
            name: "Major, Minor and Electives",
            numMajors: 1,
            numMinors: 1,
            numElectives: 4
        }
    },
    placeCourse: vi.fn(),
    pathwayRefresh: vi.fn(),
    renderCoursePlan: vi.fn(),
    renderIgnoredErrors: vi.fn(),
    switchSchedule: vi.fn(),
    loadMajorOptions: vi.fn(),
    loadMinorOptions: vi.fn(),
    createObjectURL: vi.fn(),
    revokeObjectURL: vi.fn(),
    saveButton: null,
    pathwaySelect: null,
    downloadLink: null,
    lastBlob: null,
    saveHandler: null
}));

// Replace application collaborators so imports can be tested independently.
vi.mock("../javascript/app.js", () => ({
    placeCourse: mockData.placeCourse,
    PathwayRefresh: mockData.pathwayRefresh
}));

vi.mock("../javascript/renderCoursePlan.js", () => ({
    renderCoursePlan: mockData.renderCoursePlan
}));

vi.mock("../javascript/errorDisplay.js", () => ({
    renderIgnoredErrors: mockData.renderIgnoredErrors
}));

vi.mock("../javascript/partTimeScheduleHandler.js", () => ({
    switchSchedule: mockData.switchSchedule
}));

vi.mock("../javascript/objects/majorMinorOption.js", () => ({
    loadMajorOptions: mockData.loadMajorOptions,
    loadMinorOptions: mockData.loadMinorOptions
}));

let getCode;
let getSelectedPathwayCode;
let importschedule;
let SaveFile;

// Build the standard shape written by the application's save function.
function makeImport(overrides = {}) {
    return {
        selectedPathway: "electives",
        selectedMajors: ["MajorA", null],
        selectedMinors: ["MinorA", null],
        selectedElectives: ["COMP700", "COMP701", null, null],
        schedule: Array.from({ length: 6 }, () => []),
        mode: "full-time",
        ignoredErrors: {},
        ...overrides
    };
}

beforeAll(async () => {
    mockData.loadMajorOptions.mockResolvedValue(mockData.majorOptions);
    mockData.loadMinorOptions.mockResolvedValue(mockData.minorOptions);

    mockData.pathwaySelect = {
        value: "",
        options: [
            { value: "doubleMajors" },
            { value: "electives" }
        ]
    };
    mockData.saveButton = {
        addEventListener: vi.fn((event, handler) => {
            if (event === "click") {
                mockData.saveHandler = handler;
            }
        })
    };
    mockData.downloadLink = {
        download: "",
        href: "",
        click: vi.fn()
    };

    vi.stubGlobal("document", {
        readyState: "complete",
        addEventListener: vi.fn(),
        getElementById: vi.fn(id => {
            if (id === "pathwaySelect") return mockData.pathwaySelect;
            if (id === "SaveFileButton") return mockData.saveButton;
            return null;
        }),
        createElement: vi.fn(tag =>
            tag === "a" ? mockData.downloadLink : {}
        )
    });
    vi.stubGlobal("Blob", class MockBlob {
        constructor(parts, options) {
            this.parts = parts;
            this.options = options;
            mockData.lastBlob = this;
        }
    });
    // Mock only the file-download methods; Vitest still needs URL itself.
    vi.spyOn(URL, "createObjectURL").mockImplementation(
        (...args) => mockData.createObjectURL(...args)
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(
        (...args) => mockData.revokeObjectURL(...args)
    );

    ({
        getCode,
        getSelectedPathwayCode,
        importschedule,
        SaveFile
    } = await import("../javascript/filehandler.js"));
});

afterAll(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

beforeEach(() => {
    vi.clearAllMocks();
    setScheduleMode("full-time");
    state.selectedPathway = null;
    state.selectedMajors = [null, null];
    state.selectedMinors = [null, null];
    state.selectedElectives = [null, null, null, null];
    state.ignoredErrors = {};
    mockData.pathwaySelect.value = "";
    mockData.downloadLink.download = "";
    mockData.downloadLink.href = "";
    mockData.lastBlob = null;

    mockData.pathwayRefresh.mockImplementation(pathwayCode => {
        state.selectedPathway = mockData.pathways[pathwayCode] ?? null;
    });
    mockData.placeCourse.mockImplementation((semester, slot, code) => {
        state.coursePlan[semester][slot] = mockData.courses[code] ?? null;
    });
    mockData.switchSchedule.mockImplementation(() => {
        setScheduleMode(
            scheduleConfig.mode === "full-time"
                ? "part-time"
                : "full-time"
        );
    });
    mockData.createObjectURL.mockReturnValue("blob:study-plan");
});

describe("getCode", () => {
    // Saved data may contain raw strings or either application object shape.
    test("normalizes strings and course or option objects", () => {
        expect(getCode("COMP500")).toBe("COMP500");
        expect(getCode({ Code: "MajorA" })).toBe("MajorA");
        expect(getCode({ code: "COMP600" })).toBe("COMP600");
        expect(getCode(123)).toBe("123");
    });

    // Empty and legacy sentinel values represent an unselected slot.
    test("returns null for missing selection values", () => {
        expect(getCode(null)).toBeNull();
        expect(getCode(undefined)).toBeNull();
        expect(getCode("")).toBeNull();
        expect(getCode("null")).toBeNull();
        expect(getCode("undefined")).toBeNull();
    });
});

describe("getSelectedPathwayCode", () => {
    // The visible selection is the authoritative value when it is available.
    test("prefers the pathway dropdown value", () => {
        mockData.pathwaySelect.value = "electives";
        state.selectedPathway = "doubleMajors";

        expect(getSelectedPathwayCode()).toBe("electives");
    });

    // Older application state can contain a pathway code without a DOM value.
    test("falls back to a string pathway stored in state", () => {
        mockData.pathwaySelect.value = "";
        state.selectedPathway = "doubleMajors";

        expect(getSelectedPathwayCode()).toBe("doubleMajors");
    });
});

describe("importschedule", () => {
    // Imports must be JSON objects rather than null or primitive values.
    test("rejects a non-object import", () => {
        expect(() => importschedule(null)).toThrow(
            "The imported file must contain a JSON object."
        );
        expect(() => importschedule("invalid")).toThrow(
            "The imported file must contain a JSON object."
        );
    });

    // A pathway must exist in the page's supported pathway dropdown.
    test("rejects a missing or unknown pathway", () => {
        expect(() => importschedule(makeImport({
            selectedPathway: "UnknownPathway"
        }))).toThrow("Unknown pathway code: UnknownPathway");
        expect(() => importschedule(makeImport({
            selectedPathway: null
        }))).toThrow("Unknown pathway code: missing");
    });

    // Major and minor codes are resolved to the canonical loaded objects.
    test("rejects unknown major and minor codes", () => {
        expect(() => importschedule(makeImport({
            selectedMajors: ["UnknownMajor", null]
        }))).toThrow("Unknown major code: UnknownMajor");
        expect(() => importschedule(makeImport({
            selectedMinors: ["UnknownMinor", null]
        }))).toThrow("Unknown minor code: UnknownMinor");
    });

    // A complete full-time import should restore selections, courses and notes.
    test("loads a valid full-time plan", () => {
        const ignoredErrors = {
            "MissingPreq-COMP600": "Approved exception"
        };
        const schedule = Array.from({ length: 6 }, () => []);
        schedule[0] = ["COMP500", { code: "COMP600" }, null, null];

        expect(importschedule(makeImport({
            schedule,
            ignoredErrors
        }))).toBe(true);

        expect(mockData.pathwaySelect.value).toBe("electives");
        expect(state.selectedPathway).toBe(mockData.pathways.electives);
        expect(state.selectedMajors).toEqual([
            mockData.majorOptions.MajorA,
            null
        ]);
        expect(state.selectedMinors).toEqual([
            mockData.minorOptions.MinorA,
            null
        ]);
        expect(state.selectedElectives).toEqual([
            "COMP700",
            "COMP701",
            null,
            null
        ]);
        expect(state.coursePlan[0][0]).toBe(mockData.courses.COMP500);
        expect(state.coursePlan[0][1]).toBe(mockData.courses.COMP600);
        expect(state.ignoredErrors).toBe(ignoredErrors);
        expect(mockData.switchSchedule).not.toHaveBeenCalled();
        expect(mockData.pathwayRefresh).toHaveBeenCalledTimes(2);
        expect(mockData.renderIgnoredErrors).toHaveBeenCalledOnce();
        expect(mockData.renderCoursePlan).toHaveBeenCalledWith(state);
    });

    // Importing a different mode must resize the plan before loading courses.
    test("switches to and loads a part-time plan", () => {
        const schedule = Array.from({ length: 12 }, () => []);
        schedule[11] = ["COMP700", null];

        importschedule(makeImport({
            selectedPathway: "doubleMajors",
            selectedMajors: ["MajorA", "MajorB"],
            selectedMinors: [],
            selectedElectives: [],
            schedule,
            mode: "part-time"
        }));

        expect(mockData.switchSchedule).toHaveBeenCalledOnce();
        expect(scheduleConfig.mode).toBe("part-time");
        expect(state.coursePlan).toHaveLength(12);
        expect(state.coursePlan[11][0]).toBe(mockData.courses.COMP700);
    });

    // Schedule data must be an array before any cells can be loaded.
    test("rejects an invalid schedule shape", () => {
        expect(() => importschedule(makeImport({
            schedule: { semester: [] }
        }))).toThrow("The file does not contain a valid schedule.");
    });

    // Unknown courses are skipped and reported without rejecting the import.
    test("warns about unknown course codes", () => {
        const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
        const schedule = Array.from({ length: 6 }, () => []);
        schedule[0] = ["UNKNOWN500"];

        expect(importschedule(makeImport({ schedule }))).toBe(true);
        expect(state.coursePlan[0][0]).toBeNull();
        expect(warning).toHaveBeenCalledWith(
            "Unknown course code in imported file: UNKNOWN500"
        );

        warning.mockRestore();
    });

    // Missing ignored-error data should reset notes rather than retaining them.
    test("defaults missing ignored errors to an empty object", () => {
        state.ignoredErrors = { ExistingError: "Old note" };

        importschedule(makeImport({ ignoredErrors: null }));

        expect(state.ignoredErrors).toEqual({});
    });
});

describe("SaveFile", () => {
    // Exported files should contain stable codes and trigger a JSON download.
    test("serializes state into a downloadable JSON file", () => {
        vi.useFakeTimers();
        mockData.pathwaySelect.value = "doubleMajors";
        state.selectedPathway = mockData.pathways.doubleMajors;
        state.selectedMajors = [
            mockData.majorOptions.MajorA,
            mockData.majorOptions.MajorB
        ];
        state.selectedMinors = [
            { code: "MinorA" },
            null
        ];
        state.selectedElectives = [
            "COMP700",
            { Code: "COMP701" },
            null,
            undefined
        ];
        state.coursePlan[0][0] = mockData.courses.COMP500;
        state.coursePlan[1][2] = mockData.courses.COMP600;
        state.ignoredErrors = { ExampleError: "Approved" };

        SaveFile();

        const payload = JSON.parse(mockData.lastBlob.parts[0]);
        expect(payload.selectedPathway).toBe("doubleMajors");
        expect(payload.selectedMajors).toEqual(["MajorA", "MajorB"]);
        expect(payload.selectedMinors).toEqual(["MinorA", null]);
        expect(payload.selectedElectives).toEqual([
            "COMP700",
            "COMP701",
            null,
            null
        ]);
        expect(payload.schedule[0][0]).toBe("COMP500");
        expect(payload.schedule[1][2]).toBe("COMP600");
        expect(payload.mode).toBe("full-time");
        expect(payload.ignoredErrors).toEqual({
            ExampleError: "Approved"
        });
        expect(mockData.lastBlob.options).toEqual({
            type: "application/json"
        });
        expect(mockData.downloadLink).toMatchObject({
            download: "Schedule.json",
            href: "blob:study-plan"
        });
        expect(mockData.downloadLink.click).toHaveBeenCalledOnce();

        vi.runAllTimers();
        expect(mockData.revokeObjectURL).toHaveBeenCalledWith(
            "blob:study-plan"
        );
        vi.useRealTimers();
    });
});

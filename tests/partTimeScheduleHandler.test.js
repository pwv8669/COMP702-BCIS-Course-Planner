// Unit tests for switching between full-time and part-time schedules.

import {
    afterAll,
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

const appMocks = vi.hoisted(() => ({
    refreshStudyPlan: vi.fn()
}));

// Avoid initializing the application while retaining the real schedule state.
vi.mock("../javascript/app.js", () => ({
    refreshStudyPlan: appMocks.refreshStudyPlan
}));

import {
    initPartTime,
    switchSchedule
} from "../javascript/partTimeScheduleHandler.js";

let partTimeButton;
let partTimeHeader;
let scheduleIcon;

// Create the event behavior needed by the schedule-mode button.
function makeButton() {
    const listeners = {};

    return {
        title: "",
        listeners,
        addEventListener: vi.fn((event, handler) => {
            listeners[event] = handler;
        }),
        async trigger(event) {
            return listeners[event]?.({ currentTarget: this });
        }
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    setScheduleMode("full-time");

    partTimeButton = makeButton();
    partTimeButton.title = "Switch to Part-Time Schedule";
    partTimeHeader = { style: { display: "none" } };
    scheduleIcon = { title: "Switch to Part-Time Schedule" };

    vi.stubGlobal("document", {
        getElementById: vi.fn(id => {
            if (id === "partTimeButton") return partTimeButton;
            if (id === "partTimeHeader") return partTimeHeader;
            if (id === "scheduleIcon") return scheduleIcon;
            return null;
        })
    });
});

afterAll(() => {
    vi.unstubAllGlobals();
});

describe("initPartTime", () => {
    // Initialization should connect the mode-switching function to the button.
    test("registers a click handler on the part-time button", async () => {
        await initPartTime();

        expect(partTimeButton.addEventListener).toHaveBeenCalledWith(
            "click",
            expect.any(Function)
        );

        await partTimeButton.trigger("click");
        expect(scheduleConfig.mode).toBe("part-time");
    });
});

describe("switchSchedule", () => {
    // A hidden second header means the current plan is in full-time mode.
    test("switches a full-time schedule to part-time", () => {
        switchSchedule();

        expect(scheduleConfig).toEqual({
            mode: "part-time",
            semesters: 12,
            slotsPerSemester: 2
        });
        expect(state.coursePlan).toHaveLength(12);
        expect(
            state.coursePlan.every(semester => semester.length === 2)
        ).toBe(true);
        expect(partTimeHeader.style.display).toBe("table-row");
        expect(partTimeButton.title).toBe("Switch to Full-Time Schedule");
        expect(appMocks.refreshStudyPlan).toHaveBeenCalledOnce();
    });

    // A visible second header means the current plan is in part-time mode.
    test("switches a part-time schedule back to full-time", () => {
        setScheduleMode("part-time");
        partTimeHeader.style.display = "table-row";
        partTimeButton.title = "Switch to Full-Time Schedule";

        switchSchedule();

        expect(scheduleConfig).toEqual({
            mode: "full-time",
            semesters: 6,
            slotsPerSemester: 4
        });
        expect(state.coursePlan).toHaveLength(6);
        expect(
            state.coursePlan.every(semester => semester.length === 4)
        ).toBe(true);
        expect(partTimeHeader.style.display).toBe("none");
        expect(partTimeButton.title).toBe("Switch to Part-Time Schedule");
        expect(appMocks.refreshStudyPlan).toHaveBeenCalledOnce();
    });

    // Rebuilding for a new mode intentionally starts with an empty schedule.
    test("clears existing courses when the schedule mode changes", () => {
        state.coursePlan[0][0] = { code: "COMP500" };
        state.coursePlan[5][3] = { code: "COMP700" };

        switchSchedule();

        expect(
            state.coursePlan.flat().every(course => course === null)
        ).toBe(true);
    });

    // Rendering should see the completed mode change rather than the old state.
    test("refreshes only after applying the new schedule configuration", () => {
        appMocks.refreshStudyPlan.mockImplementation(() => {
            expect(scheduleConfig.mode).toBe("part-time");
            expect(scheduleConfig.semesters).toBe(12);
            expect(scheduleConfig.slotsPerSemester).toBe(2);
            expect(partTimeHeader.style.display).toBe("table-row");
        });

        switchSchedule();

        expect(appMocks.refreshStudyPlan).toHaveBeenCalledOnce();
    });
});

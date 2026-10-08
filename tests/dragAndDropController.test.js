// Unit tests for dragging courses between the sidebar, plan cells, and page.

import {
    afterAll,
    beforeEach,
    describe,
    expect,
    test,
    vi
} from "vitest";

const mockData = vi.hoisted(() => ({
    courses: {
        COMP500: { code: "COMP500", name: "Programming Concepts" },
        COMP600: { code: "COMP600", name: "Advanced Computing" },
        COMP700: { code: "COMP700", name: "Project" }
    },
    courseCards: [],
    tableCells: [],
    body: null,
    document: null
}));

// Avoid initializing the complete application when the controller imports courses.
vi.mock("../javascript/app.js", () => ({
    courses: mockData.courses
}));

let initDragAndDrop;
let initGlobalDeleteZone;
let setScheduleMode;
let state;

// Create the DOM features used by draggable cards, cells, and the body.
function makeElement({ id = "", code = null } = {}) {
    const attributes = new Map();
    const classes = new Set();
    const listeners = {};

    if (code !== null) attributes.set("data-code", code);

    return {
        id,
        style: {},
        listeners,
        classList: {
            add: vi.fn(className => classes.add(className)),
            remove: vi.fn(className => classes.delete(className)),
            contains: className => classes.has(className)
        },
        addEventListener: vi.fn((event, handler) => {
            listeners[event] = handler;
        }),
        getAttribute: vi.fn(name => attributes.get(name) ?? null),
        setAttribute: vi.fn((name, value) => {
            attributes.set(name, value);
        }),
        removeAttribute: vi.fn(name => {
            attributes.delete(name);
        }),
        hasAttribute: name => attributes.has(name),
        attributeValue: name => attributes.get(name),
        async trigger(eventName, overrides = {}) {
            const event = {
                currentTarget: this,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
                ...overrides
            };
            const result = listeners[eventName]?.(event);
            await result;
            return event;
        }
    };
}

// Represent the browser's drag payload and retain values written by handlers.
function makeDataTransfer() {
    const data = new Map();

    return {
        setData: vi.fn((type, value) => data.set(type, value)),
        getData: vi.fn(type => data.get(type) ?? "")
    };
}

function makeCard(code) {
    return makeElement({ code });
}

function makeCell(row, column) {
    return makeElement({ id: `cell-${row}-${column}` });
}

beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockData.courseCards = [];
    mockData.tableCells = [];
    mockData.body = makeElement();
    mockData.document = {
        body: mockData.body,
        querySelectorAll: vi.fn(selector => {
            if (selector === ".course-card") return mockData.courseCards;
            if (selector === '.schedule-table td[id^="cell-"]') {
                return mockData.tableCells;
            }
            return [];
        })
    };
    vi.stubGlobal("document", mockData.document);

    // Reload both modules so every test starts with empty private drag state.
    ({ state, setScheduleMode } = await import("../javascript/state.js"));
    setScheduleMode("full-time");
    ({
        initDragAndDrop,
        initGlobalDeleteZone
    } = await import("../javascript/dragAndDropController.js"));
});

afterAll(() => {
    vi.unstubAllGlobals();
});

describe("drag source setup", () => {
    // Sidebar cards should publish their course code and show drag feedback.
    test("starts and ends a drag from a sidebar course card", async () => {
        const card = makeCard("COMP500");
        const dataTransfer = makeDataTransfer();
        mockData.courseCards = [card];

        initDragAndDrop();
        await card.trigger("dragstart", { dataTransfer });

        expect(dataTransfer.setData).toHaveBeenCalledWith(
            "text/plain",
            "COMP500"
        );
        expect(card.style.opacity).toBe("0.6");

        await card.trigger("dragend");
        expect(card.style.opacity).toBe("1.0");
    });

    // Only populated plan cells should be draggable by the user.
    test("marks populated cells as draggable and empty cells as static", () => {
        const populatedCell = makeCell(0, 0);
        const emptyCell = makeCell(0, 1);
        state.coursePlan[0][0] = mockData.courses.COMP500;
        mockData.tableCells = [populatedCell, emptyCell];

        initDragAndDrop();

        expect(populatedCell.attributeValue("draggable")).toBe("true");
        expect(populatedCell.style.cursor).toBe("grab");
        expect(emptyCell.hasAttribute("draggable")).toBe(false);
        expect(emptyCell.style.cursor).toBe("default");
    });

    // Schedule cells should display and remove their active drop-target style.
    test("updates cell feedback during drag enter, over, and leave", async () => {
        const cell = makeCell(0, 0);
        mockData.tableCells = [cell];
        initDragAndDrop();

        const enterEvent = await cell.trigger("dragenter");
        expect(enterEvent.preventDefault).toHaveBeenCalledOnce();
        expect(cell.classList.contains("drag-over-cell")).toBe(true);

        const overEvent = await cell.trigger("dragover");
        expect(overEvent.preventDefault).toHaveBeenCalledOnce();

        await cell.trigger("dragleave");
        expect(cell.classList.contains("drag-over-cell")).toBe(false);
    });
});

describe("dropping courses into the plan", () => {
    // A sidebar course should be inserted into the target plan position.
    test("places a sidebar course into an empty cell", async () => {
        const card = makeCard("COMP500");
        const targetCell = makeCell(1, 2);
        const dataTransfer = makeDataTransfer();
        const onPlanChange = vi.fn().mockResolvedValue(undefined);
        mockData.courseCards = [card];
        mockData.tableCells = [targetCell];
        initDragAndDrop(onPlanChange);

        await card.trigger("dragstart", { dataTransfer });
        await targetCell.trigger("dragenter");
        const dropEvent = await targetCell.trigger("drop");

        expect(state.coursePlan[1][2]).toBe(mockData.courses.COMP500);
        expect(dropEvent.preventDefault).toHaveBeenCalledOnce();
        expect(dropEvent.stopPropagation).toHaveBeenCalledOnce();
        expect(targetCell.classList.contains("drag-over-cell")).toBe(false);
        expect(onPlanChange).toHaveBeenCalledOnce();
    });

    // Moving to an empty plan cell should clear the original position.
    test("moves a scheduled course to an empty cell", async () => {
        const sourceCell = makeCell(0, 0);
        const targetCell = makeCell(2, 3);
        const dataTransfer = makeDataTransfer();
        const onPlanChange = vi.fn().mockResolvedValue(undefined);
        state.coursePlan[0][0] = mockData.courses.COMP500;
        mockData.tableCells = [sourceCell, targetCell];
        initDragAndDrop(onPlanChange);

        await sourceCell.trigger("dragstart", { dataTransfer });
        expect(sourceCell.style.opacity).toBe("0.4");
        await targetCell.trigger("drop");

        expect(state.coursePlan[0][0]).toBeNull();
        expect(state.coursePlan[2][3]).toBe(mockData.courses.COMP500);
        expect(onPlanChange).toHaveBeenCalledOnce();

        await sourceCell.trigger("dragend");
        expect(sourceCell.style.opacity).toBe("1.0");
    });

    // Dropping onto another course should exchange their plan positions.
    test("swaps two scheduled courses", async () => {
        const sourceCell = makeCell(0, 0);
        const targetCell = makeCell(0, 1);
        const dataTransfer = makeDataTransfer();
        state.coursePlan[0][0] = mockData.courses.COMP500;
        state.coursePlan[0][1] = mockData.courses.COMP600;
        mockData.tableCells = [sourceCell, targetCell];
        initDragAndDrop();

        await sourceCell.trigger("dragstart", { dataTransfer });
        await targetCell.trigger("drop");

        expect(state.coursePlan[0][0]).toBe(mockData.courses.COMP600);
        expect(state.coursePlan[0][1]).toBe(mockData.courses.COMP500);
    });

    // A drop event without an active drag must leave the plan unchanged.
    test("ignores a cell drop when no course is being dragged", async () => {
        const targetCell = makeCell(0, 0);
        const onPlanChange = vi.fn();
        state.coursePlan[0][0] = mockData.courses.COMP700;
        mockData.tableCells = [targetCell];
        initDragAndDrop(onPlanChange);

        await targetCell.trigger("drop");

        expect(state.coursePlan[0][0]).toBe(mockData.courses.COMP700);
        expect(onPlanChange).not.toHaveBeenCalled();
    });

    // Part-time DOM coordinates must map to the correct later semesters.
    test("moves courses using part-time schedule coordinates", async () => {
        setScheduleMode("part-time");
        const sourceCell = makeCell(0, 2);
        const targetCell = makeCell(5, 3);
        const dataTransfer = makeDataTransfer();
        state.coursePlan[6][0] = mockData.courses.COMP500;
        state.coursePlan[11][1] = mockData.courses.COMP700;
        mockData.tableCells = [sourceCell, targetCell];
        initDragAndDrop();

        await sourceCell.trigger("dragstart", { dataTransfer });
        await targetCell.trigger("drop");

        expect(state.coursePlan[6][0]).toBe(mockData.courses.COMP700);
        expect(state.coursePlan[11][1]).toBe(mockData.courses.COMP500);
    });
});

describe("global delete zone", () => {
    // Dropping a scheduled course on the page background removes it.
    test("deletes a plan course dropped outside the schedule", async () => {
        const sourceCell = makeCell(3, 1);
        const dataTransfer = makeDataTransfer();
        const onDelete = vi.fn().mockResolvedValue(undefined);
        state.coursePlan[3][1] = mockData.courses.COMP600;
        mockData.tableCells = [sourceCell];
        initDragAndDrop();
        initGlobalDeleteZone(onDelete);

        const overEvent = await mockData.body.trigger("dragover");
        expect(overEvent.preventDefault).toHaveBeenCalledOnce();

        await sourceCell.trigger("dragstart", { dataTransfer });
        const dropEvent = await mockData.body.trigger("drop");

        expect(dropEvent.preventDefault).toHaveBeenCalledOnce();
        expect(state.coursePlan[3][1]).toBeNull();
        expect(onDelete).toHaveBeenCalledOnce();
    });

    // Sidebar courses dropped on the background were never in the plan to delete.
    test("ignores a sidebar course dropped on the page background", async () => {
        const card = makeCard("COMP500");
        const dataTransfer = makeDataTransfer();
        const onDelete = vi.fn();
        mockData.courseCards = [card];
        initDragAndDrop();
        initGlobalDeleteZone(onDelete);

        await card.trigger("dragstart", { dataTransfer });
        const dropEvent = await mockData.body.trigger("drop");

        expect(dropEvent.preventDefault).not.toHaveBeenCalled();
        expect(state.coursePlan.flat().every(course => course === null)).toBe(
            true
        );
        expect(onDelete).not.toHaveBeenCalled();
    });
});

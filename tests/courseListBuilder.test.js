// Unit tests for constructing the grouped and draggable course sidebar.

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
    setScheduleMode,
    state
} from "../javascript/state.js";

const builderMocks = vi.hoisted(() => ({
    initDragAndDrop: vi.fn(),
    refreshStudyPlan: vi.fn(),
    sidebar: null,
    localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn()
    }
}));

// Rendering the sidebar should only hand its finished cards to drag handling.
vi.mock("../javascript/dragAndDropController.js", () => ({
    initDragAndDrop: builderMocks.initDragAndDrop
}));

vi.mock("../javascript/app.js", () => ({
    refreshStudyPlan: builderMocks.refreshStudyPlan
}));

import { generateDynamicCourseList } from
    "../javascript/courseListBuilder.js";

// Create the element behavior needed for accordions, lists, and course cards.
function makeElement(tagName) {
    const attributes = new Map();
    const classes = new Set();
    const listeners = {};
    let html = "";

    const element = {
        tagName: tagName.toUpperCase(),
        open: false,
        scrollTop: 0,
        textContent: "",
        children: [],
        listeners,
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        addEventListener: vi.fn((event, handler) => {
            listeners[event] ??= [];
            listeners[event].push(handler);
        }),
        setAttribute: vi.fn((name, value) => {
            attributes.set(name, value);
        }),
        getAttribute: vi.fn(name => attributes.get(name) ?? null),
        querySelector(selector) {
            if (selector === "summary") {
                return this.children.find(
                    child => child.tagName === "SUMMARY"
                ) ?? null;
            }
            return null;
        },
        querySelectorAll(selector) {
            if (selector === "details[open]") {
                return this.children.filter(
                    child => child.tagName === "DETAILS" && child.open
                );
            }
            return [];
        },
        async trigger(eventName) {
            const event = {
                currentTarget: this,
                target: this,
                preventDefault: vi.fn()
            };
            for (const handler of listeners[eventName] ?? []) {
                await handler(event);
            }
            return event;
        },
        get innerHTML() {
            return html;
        },
        set innerHTML(value) {
            html = value;
            this.children = [];
        }
    };

    Object.defineProperty(element, "className", {
        get() {
            return [...classes].join(" ");
        },
        set(value) {
            classes.clear();
            String(value).split(/\s+/).filter(Boolean).forEach(
                className => classes.add(className)
            );
        }
    });
    element.classList = {
        add: vi.fn(className => classes.add(className)),
        remove: vi.fn(className => classes.delete(className)),
        contains: className => classes.has(className)
    };

    return element;
}

// Find an accordion by the visible summary generated for it.
function findAccordion(title) {
    return builderMocks.sidebar.children.find(details =>
        details.querySelector("summary")?.textContent === title
    ) ?? null;
}

// Return the cards inside a particular level or elective accordion.
function cardsIn(title) {
    const details = findAccordion(title);
    if (!details) return [];

    const list = details.children.find(
        child => child.className === "course-list"
    );
    return list?.children ?? [];
}

function cardCodes(title) {
    return cardsIn(title).map(card => card.getAttribute("data-code"));
}

// Locate a generated card regardless of the accordion containing it.
function findCard(code) {
    for (const details of builderMocks.sidebar.children) {
        const card = cardsIn(
            details.querySelector("summary")?.textContent
        ).find(item => item.getAttribute("data-code") === code);
        if (card) return card;
    }
    return null;
}

function makeCourse(code, level = 5, name = `${code} Course`) {
    return { code, level, name, points: 15 };
}

beforeAll(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

beforeEach(() => {
    vi.clearAllMocks();
    setScheduleMode("full-time");
    state.selectedMajors = [null, null];
    state.selectedMinors = [null, null];

    builderMocks.sidebar = makeElement("aside");
    builderMocks.localStorage.getItem.mockReturnValue(null);
    vi.stubGlobal("document", {
        getElementById: vi.fn(id =>
            id === "dynamic-course-sidebar"
                ? builderMocks.sidebar
                : null
        ),
        createElement: vi.fn(tagName => makeElement(tagName))
    });
    vi.stubGlobal("localStorage", builderMocks.localStorage);
});

describe("course grouping", () => {
    // Core and selected-option courses use levels; all others are electives.
    test("groups allowed courses by level and sorts every group", () => {
        const comp610 = makeCourse("COMP610", 6, "Networks");
        const comp605 = makeCourse("COMP605", 6, "Algorithms");
        const comp550 = makeCourse("COMP550", 5, "Major Project");
        delete comp550.level;
        const comp500 = makeCourse("COMP500", 5, "Programming Concepts");
        const info700 = makeCourse("INFO700", 7, "Information Systems");
        state.selectedMajors = [{
            Requirements: [{ Courses: [comp610, comp550] }]
        }, null];
        state.selectedMinors = [{
            Requirements: [{ Courses: [comp605] }]
        }, null];

        generateDynamicCourseList({
            INFO700: info700,
            COMP610: comp610,
            COMP500: comp500,
            COMP605: comp605,
            COMP550: comp550
        });

        const headings = builderMocks.sidebar.children.map(
            details => details.querySelector("summary").textContent
        );
        expect(headings).toEqual([
            "Level 5 Courses",
            "Level 6 Courses",
            "Electives"
        ]);
        expect(cardCodes("Level 5 Courses")).toEqual([
            "COMP500",
            "COMP550"
        ]);
        expect(cardCodes("Level 6 Courses")).toEqual([
            "COMP605",
            "COMP610"
        ]);
        expect(cardCodes("Electives")).toEqual(["INFO700"]);
        expect(findCard("COMP500").textContent).toBe(
            "COMP500: Programming Concepts (15 pts)"
        );
    });

    // If every course is allowed, an empty elective accordion is unnecessary.
    test("omits the elective accordion when there are no electives", () => {
        generateDynamicCourseList({
            COMP500: makeCourse("COMP500", 5),
            COMP702: makeCourse("COMP702", 7)
        });

        expect(findAccordion("Level 5 Courses")).not.toBeNull();
        expect(findAccordion("Level 7 Courses")).not.toBeNull();
        expect(findAccordion("Electives")).toBeNull();
    });
});

describe("course card availability", () => {
    // Courses already placed in the plan must not be draggable from the sidebar.
    test("disables placed core and elective course cards", async () => {
        const comp500 = makeCourse("COMP500", 5);
        const info700 = makeCourse("INFO700", 7);
        const comp501 = makeCourse("COMP501", 5);
        state.coursePlan[0][0] = comp500;
        state.coursePlan[1][1] = info700;

        generateDynamicCourseList({
            COMP500: comp500,
            INFO700: info700,
            COMP501: comp501
        });

        const placedCore = findCard("COMP500");
        const placedElective = findCard("INFO700");
        const available = findCard("COMP501");
        expect(placedCore.classList.contains("course-card-disabled")).toBe(
            true
        );
        expect(placedElective.classList.contains("course-card-disabled")).toBe(
            true
        );
        expect(placedCore.getAttribute("draggable")).toBe("false");
        expect(placedElective.getAttribute("draggable")).toBe("false");
        expect(available.getAttribute("draggable")).toBe("true");

        const dragEvent = await placedCore.trigger("dragstart");
        expect(dragEvent.preventDefault).toHaveBeenCalledOnce();
    });
});

describe("sidebar UI state", () => {
    // Rerendering should preserve accordions the user previously opened.
    test("restores open accordions after rebuilding the sidebar", () => {
        const courses = {
            COMP500: makeCourse("COMP500", 5),
            COMP702: makeCourse("COMP702", 7)
        };
        generateDynamicCourseList(courses);
        findAccordion("Level 7 Courses").open = true;

        generateDynamicCourseList(courses);

        expect(findAccordion("Level 5 Courses").open).toBe(false);
        expect(findAccordion("Level 7 Courses").open).toBe(true);
    });

    // Stored scroll position is restored and subsequent scrolling is persisted.
    test("restores and saves the sidebar scroll position", async () => {
        builderMocks.localStorage.getItem.mockReturnValue("145");

        generateDynamicCourseList({
            COMP500: makeCourse("COMP500", 5)
        });

        expect(builderMocks.localStorage.getItem).toHaveBeenCalledWith(
            "scrollPos"
        );
        expect(builderMocks.sidebar.scrollTop).toBe(145);

        builderMocks.sidebar.scrollTop = 220;
        await builderMocks.sidebar.trigger("scroll");
        expect(builderMocks.localStorage.setItem).toHaveBeenCalledWith(
            "scrollPos",
            220
        );
    });

    // Newly created cards need their drag handlers rebound after every render.
    test("initializes drag handling with the application refresh callback", () => {
        generateDynamicCourseList({
            COMP500: makeCourse("COMP500", 5)
        });

        expect(builderMocks.initDragAndDrop).toHaveBeenCalledOnce();
        expect(builderMocks.initDragAndDrop).toHaveBeenCalledWith(
            builderMocks.refreshStudyPlan
        );
    });
});

describe("missing sidebar", () => {
    // Pages without the sidebar should exit safely and explain the omission.
    test("warns and skips rendering when the sidebar is unavailable", () => {
        builderMocks.sidebar = null;

        expect(() => generateDynamicCourseList({})).not.toThrow();

        expect(console.warn).toHaveBeenCalledWith(
            "Element 'dynamic-course-sidebar' not found in HTML."
        );
        expect(builderMocks.initDragAndDrop).not.toHaveBeenCalled();
    });
});

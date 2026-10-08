import { state } from "../state.js";
import { loadMajorOptions } from "../objects/majorMinorOption.js";
import { PlanError, ErrorSeverity } from "../objects/planError.js";

const majorOptions = await loadMajorOptions();

const MAX_DOUBLE_MAJOR_OVERLAP_POINTS = 30;
const ELECTIVE_POINTS_PER_OVERLAPPING_COURSE = 15;

// Public display map consumed by renderCoursePlan.js.
export const attributedCourses = new Map();

export function validateMajorMinorRequirements() {
    const errors = [];
    const plannedCourses = getPlannedCourses();
    const pathway = state.selectedPathway;

    attributedCourses.clear();

    if (!pathway) {
        errors.push(new PlanError(
            null,
            "No valid pathway is selected.",
            "InvalidPathway",
            ErrorSeverity.ERROR
        ));

        const ownership = new Map();
        addOwnership(
            ownership,
            buildPartialAllocation(
                majorOptions.Core,
                plannedCourses,
                new Set()
            ),
            majorOptions.Core.Code
        );
        populateDisplayMap(plannedCourses, ownership, []);
        state.attributedCourses = attributedCourses;
        return errors;
    }

    const { majorCount, minorCount } = getPathwayCounts(pathway);
    const selectedMajors = getSelectedOptions(
        state.selectedMajors,
        majorCount,
        "Major",
        errors
    );
    const selectedMinors = getSelectedOptions(
        state.selectedMinors,
        minorCount,
        "Minor",
        errors
    );
    const displayOrder = [
        majorOptions.Core,
        ...selectedMajors,
        ...selectedMinors
    ];
    const ownership = new Map();

    allocateCore(plannedCourses, ownership, errors);

    if (isDoubleMajorPathway(pathway) && selectedMajors.length === 2) {
        allocateDoubleMajors(
            selectedMajors,
            plannedCourses,
            ownership,
            errors
        );
    } else {
        allocateExclusiveOptions(
            [...selectedMajors, ...selectedMinors],
            plannedCourses,
            ownership,
            errors
        );
    }

    populateDisplayMap(plannedCourses, ownership, displayOrder);
    state.attributedCourses = attributedCourses;
    return errors;
}

function isDoubleMajorPathway(pathway = state.selectedPathway) {
    return pathway === "doubleMajors" || (
        pathway?.numMajors === 2 &&
        pathway?.numMinors === 0
    );
}

function getPathwayCounts(pathway) {
    if (typeof pathway === "object") {
        return {
            majorCount: Number(pathway.numMajors ?? 0),
            minorCount: Number(pathway.numMinors ?? 0)
        };
    }

    const pathwayCounts = {
        doubleMajors: { majorCount: 2, minorCount: 0 },
        doubleMinors: { majorCount: 1, minorCount: 2 },
        electives: { majorCount: 1, minorCount: 1 }
    };

    return pathwayCounts[pathway] ?? {
        majorCount: 0,
        minorCount: 0
    };
}

function getSelectedOptions(
    selectedOptions,
    requiredCount,
    optionType,
    errors
) {
    const options = [];

    for (let index = 0; index < requiredCount; index++) {
        const option = selectedOptions[index];

        if (option) {
            options.push(option);
            continue;
        }

        errors.push(new PlanError(
            null,
            `${optionType} ${index + 1} is missing!`,
            `Missing${optionType}-${index + 1}`,
            ErrorSeverity.ERROR
        ));
    }

    return options;
}

function getPlannedCourses() {
    const courses = new Map();

    for (const semester of state.coursePlan) {
        for (const course of semester) {
            if (course) {
                courses.set(course.code, course);
            }
        }
    }

    return courses;
}

function allocateCore(plannedCourses, ownership, errors) {
    const core = majorOptions.Core;
    const presenceErrors = addRequirementPresenceErrors(
        core,
        plannedCourses,
        errors
    );
    const solutions = presenceErrors === 0
        ? generateOptionAllocations(
            core,
            plannedCourses,
            new Set()
        )
        : [];
    const allocation = solutions[0]?.courses ??
        buildPartialAllocation(core, plannedCourses, new Set());

    addOwnership(ownership, allocation, core.Code);
}

function allocateDoubleMajors(
    majors,
    plannedCourses,
    ownership,
    errors
) {
    const blockedByCore = new Set(ownership.keys());
    const majorResults = majors.map(major => {
        const presenceErrors = addRequirementPresenceErrors(
            major,
            plannedCourses,
            errors
        );
        const solutions = presenceErrors === 0
            ? generateOptionAllocations(
                major,
                plannedCourses,
                blockedByCore
            )
            : [];

        if (presenceErrors === 0 && solutions.length === 0) {
            addExclusiveConflictErrors(
                major,
                plannedCourses,
                ownership,
                errors
            );
        }

        return { major, solutions };
    });

    if (majorResults.every(result => result.solutions.length > 0)) {
        const evaluations = [];

        for (const first of majorResults[0].solutions) {
            for (const second of majorResults[1].solutions) {
                evaluations.push(evaluateDoubleMajorPair(
                    first,
                    second,
                    plannedCourses,
                    ownership
                ));
            }
        }

        const selected = selectBestDoubleMajorPair(evaluations);

        addOwnership(
            ownership,
            selected.first.courses,
            majors[0].Code
        );
        addOwnership(
            ownership,
            selected.second.courses,
            majors[1].Code
        );

        addDoubleMajorErrors(selected, majors, errors);
        return;
    }

    for (const result of majorResults) {
        const allocation = result.solutions[0]?.courses ??
            buildPartialAllocation(
                result.major,
                plannedCourses,
                blockedByCore
            );

        addOwnership(
            ownership,
            allocation,
            result.major.Code
        );
    }
}

function evaluateDoubleMajorPair(
    first,
    second,
    plannedCourses,
    coreOwnership
) {
    const overlappingCourses = new Set(
        [...first.courses].filter(courseCode =>
            second.courses.has(courseCode)
        )
    );
    const overlapPoints = [...overlappingCourses].reduce(
        (total, courseCode) =>
            total + getCoursePoints(plannedCourses.get(courseCode)),
        0
    );
    const requiredElectivePoints =
        overlappingCourses.size *
        ELECTIVE_POINTS_PER_OVERLAPPING_COURSE;
    const allocatedCourses = new Set([
        ...coreOwnership.keys(),
        ...first.courses,
        ...second.courses
    ]);
    const electivePoints = [...plannedCourses]
        .filter(([courseCode]) => !allocatedCourses.has(courseCode))
        .reduce(
            (total, [, course]) =>
                total + getCoursePoints(course),
            0
        );

    return {
        first,
        second,
        overlappingCourses,
        overlapPoints,
        requiredElectivePoints,
        electivePoints,
        overlapWithinLimit:
            overlapPoints <= MAX_DOUBLE_MAJOR_OVERLAP_POINTS,
        electiveRequirementMet:
            electivePoints >= requiredElectivePoints
    };
}

function selectBestDoubleMajorPair(evaluations) {
    const validEvaluations = evaluations.filter(evaluation =>
        evaluation.overlapWithinLimit &&
        evaluation.electiveRequirementMet
    );

    if (validEvaluations.length > 0) {
        return validEvaluations.sort(compareDoubleMajorPairs)[0];
    }

    const withinOverlapLimit = evaluations.filter(evaluation =>
        evaluation.overlapWithinLimit
    );

    if (withinOverlapLimit.length > 0) {
        return withinOverlapLimit.sort((a, b) => {
            const aDeficit =
                a.requiredElectivePoints - a.electivePoints;
            const bDeficit =
                b.requiredElectivePoints - b.electivePoints;

            return aDeficit - bDeficit ||
                compareDoubleMajorPairs(a, b);
        })[0];
    }

    return evaluations.sort((a, b) =>
        a.overlapPoints - b.overlapPoints ||
        compareDoubleMajorPairs(a, b)
    )[0];
}

function compareDoubleMajorPairs(a, b) {
    return a.overlapPoints - b.overlapPoints ||
        (
            a.first.replacementCount +
            a.second.replacementCount
        ) - (
            b.first.replacementCount +
            b.second.replacementCount
        ) ||
        getAllocationKey(a.first.courses).localeCompare(
            getAllocationKey(b.first.courses)
        ) ||
        getAllocationKey(a.second.courses).localeCompare(
            getAllocationKey(b.second.courses)
        );
}

function addDoubleMajorErrors(evaluation, majors, errors) {
    const overlapCodes = [...evaluation.overlappingCourses];
    const majorNames = majors.map(major => major.Name).join(" & ");

    if (!evaluation.overlapWithinLimit) {
        errors.push(new PlanError(
            null,
            `${majorNames} have ${evaluation.overlapPoints} points of ` +
            `overlap (${overlapCodes.join(", ")}). A maximum of ` +
            `${MAX_DOUBLE_MAJOR_OVERLAP_POINTS} overlapping points may ` +
            "count toward both majors.",
            `DoubleMajorOverlapLimit-${majors
                .map(major => major.Code)
                .join("-")}`,
            ErrorSeverity.ERROR
        ));
        return;
    }

    if (!evaluation.electiveRequirementMet) {
        const missingPoints =
            evaluation.requiredElectivePoints -
            evaluation.electivePoints;
        const missingCourseCount = Math.ceil(
            missingPoints /
            ELECTIVE_POINTS_PER_OVERLAPPING_COURSE
        );
        const courseWord = missingCourseCount === 1
            ? "course"
            : "courses";

        errors.push(new PlanError(
            null,
            `${majorNames} use ${overlapCodes.join(", ")} toward both ` +
            `majors. Add ${missingCourseCount} additional 15-point ` +
            `elective ${courseWord} to compensate for the overlap.`,
            `MissingOverlapElectives-${overlapCodes.join("-")}`,
            ErrorSeverity.ERROR
        ));
    }
}

function allocateExclusiveOptions(
    options,
    plannedCourses,
    ownership,
    errors
) {
    const presenceErrorCounts = new Map();

    for (const option of options) {
        presenceErrorCounts.set(
            option,
            addRequirementPresenceErrors(
                option,
                plannedCourses,
                errors
            )
        );
    }

    const allRequirementsPresent = [...presenceErrorCounts.values()]
        .every(count => count === 0);

    if (allRequirementsPresent) {
        const completeSolution = findExclusiveAllocation(
            options,
            0,
            plannedCourses,
            ownership,
            []
        );

        if (completeSolution) {
            for (let index = 0; index < options.length; index++) {
                addOwnership(
                    ownership,
                    completeSolution[index].courses,
                    options[index].Code
                );
            }
            return;
        }
    }

    // Build the best useful display allocation and report every option which
    // cannot be completed without reusing an earlier option's course.
    for (const option of options) {
        const blockedCodes = new Set(ownership.keys());
        const solutions = presenceErrorCounts.get(option) === 0
            ? generateOptionAllocations(
                option,
                plannedCourses,
                blockedCodes
            )
            : [];

        if (presenceErrorCounts.get(option) === 0 && solutions.length === 0) {
            addExclusiveConflictErrors(
                option,
                plannedCourses,
                ownership,
                errors
            );
        }

        const allocation = solutions[0]?.courses ??
            buildPartialAllocation(
                option,
                plannedCourses,
                blockedCodes
            );

        addOwnership(ownership, allocation, option.Code);
    }
}

function findExclusiveAllocation(
    options,
    optionIndex,
    plannedCourses,
    ownership,
    selections
) {
    if (optionIndex === options.length) {
        return selections;
    }

    const option = options[optionIndex];
    const blockedCodes = new Set(ownership.keys());
    const solutions = generateOptionAllocations(
        option,
        plannedCourses,
        blockedCodes
    );

    for (const solution of solutions) {
        const nextOwnership = cloneOwnership(ownership);
        addOwnership(nextOwnership, solution.courses, option.Code);

        const result = findExclusiveAllocation(
            options,
            optionIndex + 1,
            plannedCourses,
            nextOwnership,
            [...selections, solution]
        );

        if (result) {
            return result;
        }
    }

    return null;
}

function generateOptionAllocations(
    option,
    plannedCourses,
    blockedCodes
) {
    const catalog = getCoursesOfferedBy(option)
        .sort((a, b) =>
            a.level - b.level ||
            a.code.localeCompare(b.code)
        );
    const solutions = [];
    const seenAllocations = new Set();

    function allocateRequirement(
        requirementIndex,
        usedCourses,
        replacementCount
    ) {
        if (requirementIndex === option.Requirements.length) {
            const key = getAllocationKey(usedCourses);

            if (!seenAllocations.has(key)) {
                seenAllocations.add(key);
                solutions.push({
                    courses: new Set(usedCourses),
                    replacementCount
                });
            }
            return;
        }

        const requirement = option.Requirements[requirementIndex];
        const assignments = getRequirementAssignments(
            requirement,
            catalog,
            plannedCourses,
            blockedCodes,
            usedCourses
        );

        for (const assignment of assignments) {
            const nextUsedCourses = new Set([
                ...usedCourses,
                ...assignment.courses
            ]);

            allocateRequirement(
                requirementIndex + 1,
                nextUsedCourses,
                replacementCount + assignment.replacementCount
            );
        }
    }

    allocateRequirement(0, new Set(), 0);

    return solutions.sort((a, b) =>
        a.replacementCount - b.replacementCount ||
        getAllocationKey(a.courses).localeCompare(
            getAllocationKey(b.courses)
        )
    );
}

function getRequirementAssignments(
    requirement,
    optionCatalog,
    plannedCourses,
    blockedCodes,
    usedCourses
) {
    if (requirement.Type === "Required") {
        if (requirement.Courses.some(course =>
            !plannedCourses.has(course.code)
        )) {
            return [];
        }

        return assignRequirementCourses(
            requirement.Courses,
            optionCatalog,
            plannedCourses,
            blockedCodes,
            usedCourses
        );
    }

    if (requirement.Type !== "ChooseN") {
        return [];
    }

    const presentCourses = requirement.Courses.filter(course =>
        plannedCourses.has(course.code)
    );

    if (presentCourses.length < requirement.Count) {
        return [];
    }

    const combinations = Array.from(
        getCombinations(presentCourses, requirement.Count)
    ).sort((a, b) =>
        countUnavailableCourses(a, blockedCodes, usedCourses) -
        countUnavailableCourses(b, blockedCodes, usedCourses)
    );
    const assignments = [];

    for (const combination of combinations) {
        assignments.push(...assignRequirementCourses(
            combination,
            optionCatalog,
            plannedCourses,
            blockedCodes,
            usedCourses
        ));
    }

    return deduplicateAssignments(assignments);
}

function assignRequirementCourses(
    requirementCourses,
    optionCatalog,
    plannedCourses,
    blockedCodes,
    usedCourses
) {
    const assignments = [];

    function assignCourse(
        courseIndex,
        workingUsedCourses,
        selectedCourses,
        replacementCount
    ) {
        if (courseIndex === requirementCourses.length) {
            assignments.push({
                courses: new Set(selectedCourses),
                replacementCount
            });
            return;
        }

        const requiredCourse = requirementCourses[courseIndex];
        const courseIsUnavailable =
            blockedCodes.has(requiredCourse.code) ||
            workingUsedCourses.has(requiredCourse.code);

        if (!courseIsUnavailable) {
            workingUsedCourses.add(requiredCourse.code);
            selectedCourses.add(requiredCourse.code);
            assignCourse(
                courseIndex + 1,
                workingUsedCourses,
                selectedCourses,
                replacementCount
            );
            selectedCourses.delete(requiredCourse.code);
            workingUsedCourses.delete(requiredCourse.code);
            return;
        }

        const replacements = optionCatalog.filter(course =>
            course.code !== requiredCourse.code &&
            course.level >= requiredCourse.level &&
            plannedCourses.has(course.code) &&
            !blockedCodes.has(course.code) &&
            !workingUsedCourses.has(course.code)
        );

        for (const replacement of replacements) {
            workingUsedCourses.add(replacement.code);
            selectedCourses.add(replacement.code);
            assignCourse(
                courseIndex + 1,
                workingUsedCourses,
                selectedCourses,
                replacementCount + 1
            );
            selectedCourses.delete(replacement.code);
            workingUsedCourses.delete(replacement.code);
        }
    }

    assignCourse(
        0,
        new Set(usedCourses),
        new Set(),
        0
    );

    return deduplicateAssignments(assignments);
}

function deduplicateAssignments(assignments) {
    const uniqueAssignments = new Map();

    for (const assignment of assignments) {
        const key = getAllocationKey(assignment.courses);
        const existing = uniqueAssignments.get(key);

        if (
            !existing ||
            assignment.replacementCount < existing.replacementCount
        ) {
            uniqueAssignments.set(key, assignment);
        }
    }

    return [...uniqueAssignments.values()].sort((a, b) =>
        a.replacementCount - b.replacementCount ||
        getAllocationKey(a.courses).localeCompare(
            getAllocationKey(b.courses)
        )
    );
}

function countUnavailableCourses(
    courses,
    blockedCodes,
    usedCourses
) {
    return courses.filter(course =>
        blockedCodes.has(course.code) ||
        usedCourses.has(course.code)
    ).length;
}

function buildPartialAllocation(
    option,
    plannedCourses,
    blockedCodes
) {
    const allocation = new Set();

    for (const requirement of option.Requirements) {
        const availableCourses = requirement.Courses.filter(course =>
            plannedCourses.has(course.code) &&
            !blockedCodes.has(course.code) &&
            !allocation.has(course.code)
        );

        if (requirement.Type === "Required") {
            for (const course of availableCourses) {
                allocation.add(course.code);
            }
            continue;
        }

        if (requirement.Type === "ChooseN") {
            const numberToAttribute = Math.min(
                requirement.Count,
                availableCourses.length
            );

            for (let index = 0; index < numberToAttribute; index++) {
                allocation.add(availableCourses[index].code);
            }
        }
    }

    return allocation;
}

function addRequirementPresenceErrors(option, plannedCourses, errors) {
    let errorCount = 0;

    for (const requirement of option.Requirements) {
        if (requirement.Type === "Required") {
            const missingCourses = requirement.Courses.filter(course =>
                !plannedCourses.has(course.code)
            );

            if (missingCourses.length === 0) {
                continue;
            }

            const missingCodes = missingCourses.map(course => course.code);
            errors.push(new PlanError(
                null,
                `Missing required courses for ${option.Name}: ` +
                `${missingCodes.join(", ")}.`,
                `MissingCourse-${missingCodes.join("-")}-${option.Name}`
            ));
            errorCount++;
            continue;
        }

        if (requirement.Type !== "ChooseN") {
            continue;
        }

        const presentCount = requirement.Courses.filter(course =>
            plannedCourses.has(course.code)
        ).length;

        if (presentCount >= requirement.Count) {
            continue;
        }

        const courseCodes = requirement.Courses.map(course => course.code);
        errors.push(new PlanError(
            null,
            `Missing courses for ${option.Name}: choose at least ` +
            `${requirement.Count} of ${courseCodes.join(", ")}.`,
            `MissingReqs-${courseCodes.join("-")}-` +
            `${option.Name}-${requirement.Count}`
        ));
        errorCount++;
    }

    return errorCount;
}

function addExclusiveConflictErrors(
    option,
    plannedCourses,
    ownership,
    errors
) {
    let errorAdded = false;

    for (const requirement of option.Requirements) {
        const overlappingCourses = requirement.Courses.filter(course =>
            plannedCourses.has(course.code) &&
            ownership.has(course.code)
        );

        if (overlappingCourses.length === 0) {
            continue;
        }

        if (requirement.Type === "Required") {
            for (const course of overlappingCourses) {
                addExclusiveCourseError(
                    option,
                    [course],
                    ownership,
                    errors
                );
                errorAdded = true;
            }
            continue;
        }

        if (requirement.Type !== "ChooseN") {
            continue;
        }

        const availableCount = requirement.Courses.filter(course =>
            plannedCourses.has(course.code) &&
            !ownership.has(course.code)
        ).length;
        const replacementsNeeded = Math.max(
            0,
            requirement.Count - availableCount
        );

        if (replacementsNeeded === 0) {
            continue;
        }

        addExclusiveCourseError(
            option,
            overlappingCourses.slice(0, replacementsNeeded),
            ownership,
            errors
        );
        errorAdded = true;
    }

    if (!errorAdded) {
        errors.push(new PlanError(
            null,
            `${option.Name} cannot be completed with distinct courses. ` +
            `Add another course from within ${option.Name} at the same or ` +
            "a higher level than the requirement it replaces.",
            `ExclusiveAllocation-${option.Code}`,
            ErrorSeverity.ERROR
        ));
    }
}

function addExclusiveCourseError(
    option,
    overlappingCourses,
    ownership,
    errors
) {
    const courseCodes = overlappingCourses.map(course => course.code);
    const ownerCodes = new Set();

    for (const courseCode of courseCodes) {
        for (const ownerCode of ownership.get(courseCode) ?? []) {
            ownerCodes.add(ownerCode);
        }
    }

    const ownerNames = [...ownerCodes].map(getOptionName);
    const courseWord = overlappingCourses.length === 1
        ? "course"
        : "courses";
    const verb = overlappingCourses.length === 1
        ? "is"
        : "are";

    errors.push(new PlanError(
        null,
        `${courseCodes.join(", ")} ${verb} already attributed to ` +
        `${ownerNames.join(" & ")} and cannot also count toward ` +
        `${option.Name}. Add ${overlappingCourses.length} different ` +
        `${option.Name} ${courseWord} at the same or a higher level.`,
        `ExclusiveOverlap-${option.Code}-${courseCodes.join("-")}`,
        ErrorSeverity.ERROR
    ));
}

function addOwnership(ownership, courseCodes, optionCode) {
    for (const courseCode of courseCodes) {
        if (!ownership.has(courseCode)) {
            ownership.set(courseCode, new Set());
        }

        ownership.get(courseCode).add(optionCode);
    }
}

function cloneOwnership(ownership) {
    return new Map(
        [...ownership].map(([courseCode, owners]) => [
            courseCode,
            new Set(owners)
        ])
    );
}

function populateDisplayMap(
    plannedCourses,
    ownership,
    displayOrder
) {
    const displayIndexes = new Map(
        displayOrder.map((option, index) => [option.Code, index])
    );

    for (const courseCode of plannedCourses.keys()) {
        const owners = ownership.get(courseCode);

        if (!owners || owners.size === 0) {
            attributedCourses.set(courseCode, "Elective");
            continue;
        }

        if (owners.has(majorOptions.Core.Code)) {
            attributedCourses.set(courseCode, majorOptions.Core.Code);
            continue;
        }

        const orderedOwners = [...owners].sort((a, b) =>
            (displayIndexes.get(a) ?? Infinity) -
            (displayIndexes.get(b) ?? Infinity)
        );

        attributedCourses.set(
            courseCode,
            orderedOwners.join(" & ")
        );
    }
}

function getCoursesOfferedBy(option) {
    const courses = new Map();

    for (const requirement of option.Requirements) {
        for (const course of requirement.Courses) {
            courses.set(course.code, course);
        }
    }

    return [...courses.values()];
}

function getOptionName(optionCode) {
    if (optionCode === majorOptions.Core.Code) {
        return majorOptions.Core.Name;
    }

    for (const option of [
        ...state.selectedMajors,
        ...state.selectedMinors
    ]) {
        if (option?.Code === optionCode) {
            return option.Name;
        }
    }

    return optionCode;
}

function getCoursePoints(course) {
    const points = Number(course?.points);
    return Number.isFinite(points) ? points : 0;
}

function getAllocationKey(courseCodes) {
    return [...courseCodes].sort().join("|");
}

function* getCombinations(
    values,
    count,
    startIndex = 0,
    combination = []
) {
    if (count < 0 || count > values.length) {
        return;
    }

    if (combination.length === count) {
        yield [...combination];
        return;
    }

    const valuesStillNeeded = count - combination.length;
    const finalStartIndex = values.length - valuesStillNeeded;

    for (let index = startIndex; index <= finalStartIndex; index++) {
        combination.push(values[index]);
        yield* getCombinations(
            values,
            count,
            index + 1,
            combination
        );
        combination.pop();
    }
}

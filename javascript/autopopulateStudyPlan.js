// This module builds and schedules courses that satisfy the selected options.
// It searches ChooseN choices and overlapping requirement substitutions.
import { refreshStudyPlan } from './app.js';
import { state } from './state.js';
import { loadMajorOptions } from "./objects/majorMinorOption.js";
import { evaluatePrerequisiteTree } from './validation/prerequisiteValidator.js';
import { loadCourses, NodeType } from './objects/course.js';

const coursesObject = await loadCourses();
const majorOptions = await loadMajorOptions();

/*
isDoubleMajorPathway: Checks whether the selected pathway has two majors.
Inputs: N/A
Outputs: isDoubleMajor (boolean)

Reads selectedPathway from state.js.
*/
function isDoubleMajorPathway() {
    const pathway = state.selectedPathway;

    return pathway === "doubleMajors" || (
        pathway?.numMajors === 2 &&
        pathway?.numMinors === 0
    );
}

// Track the option which first receives each required course and every later
// option whose identical requirement must be fulfilled by a substitute.
const requiredCourseOwners = new Map();
const requiredCourseSubstitutions = [];

const chooseNSubstitutions = [];
const chooseNRequirementOwners = new WeakMap();
const maxDoubleMajorOverlapPoints = 30;

/*
 * Course data and semester rules are static for the lifetime of the page, so
 * the same selected course set always has the same scheduling result. This
 * cache also avoids solving an identical set reached through different
 * requirement-choice paths.
 */
const scheduleCache = new Map();
const effectivePrerequisiteTreeCache = new WeakMap();

// Connect the autocomplete button to the study plan generator.
const button = document.getElementById('AutocompletePlanButton');
button.addEventListener('click', () => {
    autocompleteStudyPlan();
});

/*
autocompleteStudyPlan: Generates and displays an automatic study plan.
Inputs: N/A
Outputs: N/A

Calls refreshStudyPlan from app.js to update the displayed HTML.
*/
function autocompleteStudyPlan() {
    if (!generateStudyPlan()) {
        return;
    }

    refreshStudyPlan();
}

/*
generateStudyPlan: Generates and stores a study plan without rendering it.
Inputs: N/A
Outputs: generated (boolean)

The scheduling process updates coursePlan in state.js only when successful.
*/
export function generateStudyPlan() {
    // Stop when the required pathway options have not been selected.
    if (!checkIfMajorsAndMinorsSelected()) {
        return false;
    }

    // Clear substitution data left by an earlier generation attempt.
    requiredCourseOwners.clear();
    requiredCourseSubstitutions.length = 0;
    chooseNSubstitutions.length = 0;

    // Stop when no valid selection and schedule can be built.
    const selectedCourses = buildCourseList();
    if (!selectedCourses) {
        alert("Unable to generate a valid study plan.");
        return false;
    }

    return true;
}

/*
buildCourseList: Builds the courses needed by the selected pathway options.
Inputs: N/A
Outputs: selectedCourses (Map of course codes to Course objects), or null
*/
function buildCourseList() {
    const selectedCourses = new Map();

    addCoreCourses(selectedCourses);
    addRequiredCourses(selectedCourses);

    const chooseNRequirements =
        getAllChooseNRequirements();

    if (!tryChooseNRequirements(
        chooseNRequirements,
        0,
        selectedCourses
    )) {
        return null;
    }

    return selectedCourses;
}

/*
addCoreCourses: Adds required Core courses to the selected course map.
Inputs: selectedCourses (Map of course codes to Course objects)
Outputs: N/A

Reads Core requirements loaded from majors.json.
*/
function addCoreCourses(selectedCourses) {
    const core = majorOptions["Core"];
    if (!core) return;

    for (const requirement of core.Requirements) {
        if (requirement.Type !== "Required") continue;
            
        for (const course of requirement.Courses) {
            if (selectedCourses.has(course.code)) continue;
            selectedCourses.set(course.code, course);
            requiredCourseOwners.set(course.code, core);
        }
    }
}

/*
addRequiredCourses: Adds required major and minor courses in validation order.
Inputs: selectedCourses (Map of course codes to Course objects)
Outputs: N/A

Reads selectedPathway, selectedMajors, and selectedMinors from state.js.
Records both options involved in each overlapping course requirement.
*/
function addRequiredCourses(selectedCourses) {
    const selectedPathway = state.selectedPathway;

    // Add required courses from each selected major.
    for (let i = 0; i < selectedPathway.numMajors; i++) {
        const major = state.selectedMajors[i];
        if (!major) continue;

        addRequiredCoursesFromOption(
            major,
            selectedCourses
        );
    }

    // Add required courses from each selected minor.
    for (let i = 0; i < selectedPathway.numMinors; i++) {
        const minor = state.selectedMinors[i];
        if (!minor) continue;

        addRequiredCoursesFromOption(
            minor,
            selectedCourses
        );
    }
}

/*
addRequiredCoursesFromOption: Adds required courses from one pathway option.
Inputs: option (MajorOption or MinorOption object), selectedCourses (Map)
Outputs: N/A

Records overlapping requirements for later substitution.
*/
function addRequiredCoursesFromOption(
    option,
    selectedCourses
) {
    for (const requirement of option.Requirements) {
        if (requirement.Type !== "Required") continue;

        for (const course of requirement.Courses) {
            if (selectedCourses.has(course.code)) {
                requiredCourseSubstitutions.push({
                    duplicatedCourse: course,
                    possessingOption:
                        requiredCourseOwners.get(course.code),
                    unfulfilledOption: option
                });
                continue;
            }

            selectedCourses.set(course.code, course);
            requiredCourseOwners.set(course.code, option);
        }
    }
}

/*
tryChooseNRequirements: Selects courses for every ChooseN requirement.
Inputs: requirements (array), index (integer), selectedCourses (Map)
Outputs: completed (boolean)

Uses recursive backtracking and schedules a completed course selection.
*/
function tryChooseNRequirements(
    requirements,
    index,
    selectedCourses
) {
    // All ChooseN requirements have been processed.
    if (index === requirements.length) {
        return tryOverlapSubstitutions(
            selectedCourses
        );
    }

    const requirement = requirements[index];

    const availableCourses =
        requirement.Courses.filter(
            course =>
                !selectedCourses.has(course.code)
        );
    const orderedAvailableCourses =
        orderRequirementCourses(
            availableCourses,
            selectedCourses
        );
    const overlappingCourses =
        requirement.Courses.filter(
            course =>
                selectedCourses.has(course.code)
        );
    const overlappingCourseCount =
        overlappingCourses.length;
    const minimumSubstitutionCount =
        Math.max(
            0,
            requirement.Count -
                orderedAvailableCourses.length
        );
    const maximumSubstitutionCount =
        Math.min(
            requirement.Count,
            overlappingCourseCount
        );

    /*
     * Prefer unused requirement courses, but also explore using an already
     * attributed requirement course plus a substitute. This alternative is
     * important when the unused course cannot be scheduled because its own
     * prerequisites are absent.
     */
    for (
        let substitutionCount =
            minimumSubstitutionCount;
        substitutionCount <=
            maximumSubstitutionCount;
        substitutionCount++
    ) {
        const newCourseCount =
            requirement.Count -
            substitutionCount;

        for (const combination of getCombinations(
            orderedAvailableCourses,
            newCourseCount
        )) {
            for (const course of combination) {
                selectedCourses.set(
                    course.code,
                    course
                );
            }

            if (substitutionCount > 0) {
                chooseNSubstitutions.push({
                    requirement,
                    unfulfilledOption:
                        chooseNRequirementOwners.get(requirement),
                    count: substitutionCount,
                    points: overlappingCourses
                        .slice(0, substitutionCount)
                        .reduce(
                            (total, course) =>
                                total + course.points,
                            0
                        )
                });
            }

            if (
                tryChooseNRequirements(
                    requirements,
                    index + 1,
                    selectedCourses
                )
            ) {
                return true;
            }

            if (substitutionCount > 0) {
                chooseNSubstitutions.pop();
            }

            for (const course of combination) {
                selectedCourses.delete(
                    course.code
                );
            }
        }
    }

    return false;
}

/*
orderRequirementCourses: Orders ChooseN courses for the selection search.
Inputs: courses (array of Course objects), selectedCourses (Map)
Outputs: orderedCourses (array of Course objects)

Courses with available prerequisites are tried first. Original JSON order is
preserved within each group.
*/
function orderRequirementCourses(
    courses,
    selectedCourses
) {
    const selectedCourseCodes =
        new Set(selectedCourses.keys());

    return courses
        .map(
            (course, originalIndex) => ({
                course,
                originalIndex,
                prerequisitesAvailable:
                    prerequisiteTreeIsCovered(
                        getEffectivePrerequisiteTree(course),
                        selectedCourseCodes
                    )
            })
        )
        .sort((a, b) => {
            if (
                a.prerequisitesAvailable !==
                b.prerequisitesAvailable
            ) {
                return a.prerequisitesAvailable
                    ? -1
                    : 1;
            }

            return (
                a.originalIndex -
                b.originalIndex
            );
        })
        .map(entry => entry.course);
}

/*
getCombinations: Yields each course combination of the requested size.
Inputs: courses (array), count (integer), startIndex (integer),
currentCombination (array)
Outputs: combinations (generator of arrays)

The lazy search stops building combinations after a valid plan is found.
*/
function* getCombinations(
    courses,
    count,
    startIndex = 0,
    currentCombination = []
) {
    if (count < 0 || count > courses.length) {
        return;
    }

    if (currentCombination.length === count) {
        yield [...currentCombination];
        return;
    }

    const coursesStillNeeded =
        count - currentCombination.length;
    const finalStartIndex =
        courses.length - coursesStillNeeded;

    for (
        let i = startIndex;
        i <= finalStartIndex;
        i++
    ) {
        currentCombination.push(courses[i]);

        yield* getCombinations(
            courses,
            count,
            i + 1,
            currentCombination
        );

        currentCombination.pop();
    }
}

/*
getAllChooseNRequirements: Collects ChooseN requirements in validation order.
Inputs: N/A
Outputs: requirements (array of requirement objects)

Reads the Core option and selected pathway options from state.js.
*/
function getAllChooseNRequirements() {
    const requirements = [];
    const selectedPathway = state.selectedPathway;

    const options = [
        majorOptions.Core,
        ...state.selectedMajors.slice(
            0,
            selectedPathway.numMajors
        ),
        ...state.selectedMinors.slice(
            0,
            selectedPathway.numMinors
        )
    ].filter(option => option);

    for (const option of options) {
        for (const requirement of option.Requirements) {
            if (requirement.Type !== "ChooseN") {
                continue;
            }

            chooseNRequirementOwners.set(
                requirement,
                option
            );
            requirements.push(requirement);
        }
    }

    return requirements;
}

/*
tryOverlapSubstitutions: Selects substitutes for overlapping requirements.
Inputs: selectedCourses (Map of course codes to Course objects)
Outputs: completed (boolean)

Reads the elective count from selectedPathway in state.js.
*/
function tryOverlapSubstitutions(selectedCourses) {
    const replacementGroups = [
        ...getReplacementGroups(),
        ...getChooseNReplacementGroups()
    ];
    const selectedPathway =
        state.selectedPathway;

    if (selectedPathway.numElectives > 0) {
        replacementGroups.push({
            isElective: true,
            count: selectedPathway.numElectives
        });
    }

    return tryReplacementGroups(
        replacementGroups,
        selectedCourses
    );
}

/*
tryReplacementGroups: Selects and schedules courses for replacement groups.
Inputs: replacementGroups (array), selectedCourses (Map)
Outputs: completed (boolean)

Updates selectedElectives in state.js after a valid elective choice is found.
The most constrained group is recalculated at each search level.
*/
function tryReplacementGroups(
    replacementGroups,
    selectedCourses
) {
    // All overlap replacements have been selected.
    if (replacementGroups.length === 0) {
        return scheduleCourses(
            new Map(selectedCourses)
        );
    }

    let selectedGroupIndex = -1;
    let availableCourses = null;
    let smallestBranchCount = Infinity;
    const candidateLists = [];
    const potentiallySelectableCourseCodes =
        new Set(selectedCourses.keys());

    for (
        let index = 0;
        index < replacementGroups.length;
        index++
    ) {
        const group = replacementGroups[index];
        const candidates =
            getReplacementCandidates(
                group,
                selectedCourses
            );
        candidateLists.push(candidates);

        for (const candidate of candidates) {
            potentiallySelectableCourseCodes.add(
                candidate.code
            );
        }
    }

    /*
     * A selected course may currently be waiting for a prerequisite supplied
     * by a later replacement group. If even the union of every remaining
     * candidate cannot provide that prerequisite, this entire branch can be
     * rejected before generating combinations.
     */
    for (const course of selectedCourses.values()) {
        if (
            !prerequisiteTreeIsCovered(
                getEffectivePrerequisiteTree(course),
                potentiallySelectableCourseCodes
            ) ||
            !prerequisiteTreeIsCovered(
                course.corequisites,
                potentiallySelectableCourseCodes
            )
        ) {
            return false;
        }
    }

    for (
        let index = 0;
        index < replacementGroups.length;
        index++
    ) {
        const group = replacementGroups[index];
        const candidates =
            candidateLists[index].filter(
                course =>
                    prerequisiteTreeIsCovered(
                        getEffectivePrerequisiteTree(course),
                        potentiallySelectableCourseCodes
                    ) &&
                    prerequisiteTreeIsCovered(
                        course.corequisites,
                        potentiallySelectableCourseCodes
                    )
            );

        if (candidates.length < group.count) {
            return false;
        }

        const branchCount =
            getCombinationCount(
                candidates.length,
                group.count
            );

        if (branchCount < smallestBranchCount) {
            selectedGroupIndex = index;
            availableCourses = candidates;
            smallestBranchCount = branchCount;
        }
    }

    const group =
        replacementGroups[selectedGroupIndex];
    const remainingGroups =
        replacementGroups.filter(
            (_, index) =>
                index !== selectedGroupIndex
        );

    for (const combination of getCombinations(
        availableCourses,
        group.count
    )) {

        // Add this replacement combination.
        for (const course of combination) {
            selectedCourses.set(
                course.code,
                course
            );
        }

        // Try the next replacement group.
        if (
            tryReplacementGroups(
                remainingGroups,
                selectedCourses
            )
        ) {
            if (group.isElective) {
                state.selectedElectives =
                    combination.map(
                        course => course.code
                    );
            }

            return true;
        }

        // Backtrack.
        for (const course of combination) {
            selectedCourses.delete(
                course.code
            );
        }
    }

    return false;
}

/*
getReplacementCandidates: Gets ordered candidates for one replacement group.
Inputs: group (object), selectedCourses (Map)
Outputs: candidates (array of Course objects)
*/
function getReplacementCandidates(
    group,
    selectedCourses
) {
    let candidates;

    if (group.isElective) {
        candidates =
            getAvailableElectiveCourses(
                selectedCourses
            );
    } else if (group.requirement) {
        candidates =
            getAvailableChooseNReplacementCourses(
                group,
                selectedCourses
            );
    } else {
        candidates =
            getAvailableReplacementCourses(
                group,
                selectedCourses
            );
    }

    return orderCandidateCourses(
        candidates,
        selectedCourses
    );
}

/*
orderCandidateCourses: Orders replacement candidates for the search.
Inputs: candidates (array of Course objects), selectedCourses (Map)
Outputs: orderedCandidates (array of Course objects)

Useful prerequisites, available prerequisites, flexible offerings, and lower
levels determine search order. Every candidate remains available.
*/
function orderCandidateCourses(
    candidates,
    selectedCourses
) {
    const selectedCourseCodes =
        new Set(selectedCourses.keys());
    const neededPrerequisiteCounts =
        new Map();

    for (
        const selectedCourse
        of selectedCourses.values()
    ) {
        const prerequisiteCodes =
            new Set();

        collectPrerequisiteCodes(
            getEffectivePrerequisiteTree(selectedCourse),
            prerequisiteCodes
        );
        collectPrerequisiteCodes(
            selectedCourse.corequisites,
            prerequisiteCodes
        );

        for (
            const prerequisiteCode
            of prerequisiteCodes
        ) {
            if (
                selectedCourseCodes.has(
                    prerequisiteCode
                )
            ) {
                continue;
            }

            neededPrerequisiteCounts.set(
                prerequisiteCode,
                (
                    neededPrerequisiteCounts.get(
                        prerequisiteCode
                    ) ?? 0
                ) + 1
            );
        }
    }

    return [...candidates].sort((a, b) => {
        const prerequisiteUsefulnessDifference =
            (
                neededPrerequisiteCounts.get(
                    b.code
                ) ?? 0
            ) -
            (
                neededPrerequisiteCounts.get(
                    a.code
                ) ?? 0
            );

        if (
            prerequisiteUsefulnessDifference !==
            0
        ) {
            return prerequisiteUsefulnessDifference;
        }

        const aPrerequisitesAvailable =
            prerequisiteTreeIsCovered(
                getEffectivePrerequisiteTree(a),
                selectedCourseCodes
            );
        const bPrerequisitesAvailable =
            prerequisiteTreeIsCovered(
                getEffectivePrerequisiteTree(b),
                selectedCourseCodes
            );

        if (
            aPrerequisitesAvailable !==
            bPrerequisitesAvailable
        ) {
            return aPrerequisitesAvailable
                ? -1
                : 1;
        }

        const aOfferingCount =
            Number(a.semester1Offered) +
            Number(a.semester2Offered);
        const bOfferingCount =
            Number(b.semester1Offered) +
            Number(b.semester2Offered);

        if (aOfferingCount !== bOfferingCount) {
            return (
                bOfferingCount -
                aOfferingCount
            );
        }

        return a.level - b.level;
    });
}

/*
getEffectivePrerequisiteTree: Builds all prerequisites for one course.
Inputs: course (Course object)
Outputs: prerequisiteTree (object), or null

Reads selectedMajors from state.js. Dynamic requirements are converted to the
same AND/OR tree used by ordinary prerequisites.
*/
function getEffectivePrerequisiteTree(course) {
    const maximumLevel =
        course.requiresAllCoreAndMajorRequirementsUpToLevel;

    if (maximumLevel === null || maximumLevel === undefined) {
        return course.prerequisites;
    }

    const selectedMajorCodes = state.selectedMajors
        .filter(major => major)
        .map(major => major.Code)
        .sort();
    const cacheKey =
        `${maximumLevel}|${selectedMajorCodes.join("|")}`;
    const cached =
        effectivePrerequisiteTreeCache.get(course);

    if (cached?.key === cacheKey) {
        return cached.tree;
    }

    const options = [
        majorOptions.Core,
        ...state.selectedMajors.filter(major => major)
    ].filter(option => option);
    const requirementNodes = [];

    for (const option of options) {
        for (const requirement of option.Requirements) {
            const requirementNode =
                buildRequirementPrerequisiteTree(
                    requirement,
                    maximumLevel
                );

            if (requirementNode) {
                requirementNodes.push(requirementNode);
            }
        }
    }

    const dynamicTree = combinePrerequisiteNodes(
        NodeType.AND,
        requirementNodes
    );
    const effectiveTree = combinePrerequisiteNodes(
        NodeType.AND,
        [course.prerequisites, dynamicTree].filter(node => node)
    );

    effectivePrerequisiteTreeCache.set(course, {
        key: cacheKey,
        tree: effectiveTree
    });

    return effectiveTree;
}

/*
buildRequirementPrerequisiteTree: Converts one requirement to an AND/OR tree.
Inputs: requirement (object), maximumLevel (integer)
Outputs: prerequisiteTree (object), or null
*/
function buildRequirementPrerequisiteTree(
    requirement,
    maximumLevel
) {
    const courseNodes = requirement.Courses
        .filter(course => course.level <= maximumLevel)
        .map(course => ({
            type: NodeType.COURSE,
            value: course.code,
            children: []
        }));

    if (courseNodes.length === 0) {
        return null;
    }

    if (requirement.Type === "Required") {
        return combinePrerequisiteNodes(
            NodeType.AND,
            courseNodes
        );
    }

    if (requirement.Type === "ChooseN") {
        const alternatives = Array.from(
            getCombinations(
                courseNodes,
                requirement.Count
            ),
            combination =>
                combinePrerequisiteNodes(
                    NodeType.AND,
                    combination
                )
        );

        return alternatives.length > 0
            ? combinePrerequisiteNodes(
                NodeType.OR,
                alternatives
            )
            : {
                type: "INVALID",
                children: []
            };
    }

    return {
        type: "INVALID",
        children: []
    };
}

/*
combinePrerequisiteNodes: Combines prerequisite nodes under one operator.
Inputs: type (string), nodes (array of prerequisite nodes)
Outputs: combinedNode (object), or null
*/
function combinePrerequisiteNodes(type, nodes) {
    if (nodes.length === 0) {
        return null;
    }

    if (nodes.length === 1) {
        return nodes[0];
    }

    return {
        type,
        children: nodes
    };
}

/*
prerequisiteTreeIsCovered: Checks whether course codes cover a tree.
Inputs: node (prerequisite node), courseCodes (Set of strings)
Outputs: isCovered (boolean)
*/
function prerequisiteTreeIsCovered(
    node,
    courseCodes
) {
    if (!node) {
        return true;
    }

    if (node.type === "COURSE") {
        return courseCodes.has(node.value);
    }

    if (node.type === "AND") {
        return node.children.every(
            child =>
                prerequisiteTreeIsCovered(
                    child,
                    courseCodes
                )
        );
    }

    if (node.type === "OR") {
        return node.children.some(
            child =>
                prerequisiteTreeIsCovered(
                    child,
                    courseCodes
                )
        );
    }

    return false;
}

/*
getCombinationCount: Calculates how many combinations a selection can make.
Inputs: numberOfCourses (integer), count (integer)
Outputs: combinationCount (integer)
*/
function getCombinationCount(
    numberOfCourses,
    count
) {
    if (
        count < 0 ||
        count > numberOfCourses
    ) {
        return 0;
    }

    const smallerCount =
        Math.min(
            count,
            numberOfCourses - count
        );
    let result = 1;

    for (
        let i = 1;
        i <= smallerCount;
        i++
    ) {
        result *=
            (numberOfCourses - smallerCount + i) /
            i;
    }

    return result;
}

/*
getReplacementGroups: Builds groups for overlapping required courses.
Inputs: N/A
Outputs: replacementGroups (array)

Each group retains both pathway options used by the requirements validator.
*/
function getReplacementGroups() {
    return requiredCourseSubstitutions.map(
        substitution => ({
            ...substitution,
            count: 1
        })
    );
}

/*
getChooseNReplacementGroups: Builds groups for overlapping ChooseN courses.
Inputs: N/A
Outputs: replacementGroups (array)
*/
function getChooseNReplacementGroups() {
    return chooseNSubstitutions.map(
        substitution => ({
            duplicatedCourse: null,
            requirement: substitution.requirement,
            unfulfilledOption: substitution.unfulfilledOption,
            count: substitution.count,
            points: substitution.points
        })
    );
}

/*
getAvailableReplacementCourses: Gets substitutes for a required course.
Inputs: group (replacement group), selectedCourses (Map)
Outputs: availableCourses (array of Course objects)

Double-major overlaps use electives within the overlap limit. Other pathways
use a same-or-higher-level course from the unfulfilled option.
*/
function getAvailableReplacementCourses(
    group,
    selectedCourses
) {
    const isDoubleMajor =
        isDoubleMajorPathway();

    const requiredSubstitutionPoints =
        getRequiredSubstitutionPoints();

    if (isDoubleMajor) {
        if (
            requiredSubstitutionPoints >
            maxDoubleMajorOverlapPoints
        ) {
            return [];
        }

        return getAvailableDoubleMajorElectiveCourses(
            selectedCourses
        );
    }

    const courseMap = new Map();

    addCoursesFromOption(
        group.unfulfilledOption,
        courseMap
    );

    return Array.from(courseMap.values())
        .filter(course => {
            if (selectedCourses.has(course.code)) {
                return false;
            }

            if (
                course.level <
                group.duplicatedCourse.level
            ) {
                return false;
            }

            return true;
        })
        .sort((a, b) => a.level - b.level);
}

/*
getAvailableChooseNReplacementCourses: Gets substitutes for a ChooseN overlap.
Inputs: group (replacement group), selectedCourses (Map)
Outputs: availableCourses (array of Course objects)

Double-major candidates must remain within the allowed overlap points.
*/
function getAvailableChooseNReplacementCourses(
    group,
    selectedCourses
) {
    const isDoubleMajor =
        isDoubleMajorPathway();

    const requiredSubstitutionPoints =
        getRequiredSubstitutionPoints();

    const chooseNSubstitutionPoints =
        chooseNSubstitutions.reduce(
            (total, substitution) =>
                total + substitution.points,
            0
        );

    const totalSubstitutionPoints =
        requiredSubstitutionPoints +
        chooseNSubstitutionPoints;

    if (isDoubleMajor) {
        if (
            totalSubstitutionPoints >
            maxDoubleMajorOverlapPoints
        ) {
            // Reject this ChooseN branch so the caller can try a combination
            // with no more than 30 points of double-major overlap.
            return [];
        }

        return getAvailableDoubleMajorElectiveCourses(
            selectedCourses
        );
    }

    // Major/minor overlaps require a replacement from within the option whose
    // requirement is unfulfilled. The replacement must be at least the level
    // of the overlapping ChooseN course.
    const minimumLevel =
        Math.min(
            ...group.requirement.Courses.map(
                course => course.level
            )
        );

    const replacementCourses = new Map();
    addCoursesFromOption(
        group.unfulfilledOption,
        replacementCourses
    );

    return [...replacementCourses.values()]
        .filter(course => {

            if (
                selectedCourses.has(
                    course.code
                )
            ) {
                return false;
            }

            return (
                course.level >=
                minimumLevel
            );
        })
        .sort(
            (a, b) =>
                a.level - b.level
        );
}

/*
getRequiredSubstitutionPoints: Totals required-course overlap points.
Inputs: N/A
Outputs: substitutionPoints (number)
*/
function getRequiredSubstitutionPoints() {
    return requiredCourseSubstitutions.reduce(
        (total, substitution) =>
            total + substitution.duplicatedCourse.points,
        0
    );
}

/*
getAvailableElectiveCourses: Gets courses not already selected for the plan.
Inputs: selectedCourses (Map)
Outputs: availableCourses (array of Course objects)
*/
function getAvailableElectiveCourses(selectedCourses) {
    return Object.values(coursesObject).filter(
        course => !selectedCourses.has(course.code)
    );
}

/*
getAvailableDoubleMajorElectiveCourses: Gets valid double-major electives.
Inputs: selectedCourses (Map)
Outputs: availableCourses (array of Course objects)

Reads selectedMajors from state.js and excludes their requirement courses.
*/
function getAvailableDoubleMajorElectiveCourses(selectedCourses) {
    const selectedMajorCourseCodes = new Set(
        state.selectedMajors
            .filter(major => major)
            .flatMap(major =>
                major.Requirements.flatMap(requirement =>
                    requirement.Courses.map(course => course.code)
                )
            )
    );

    return Object.values(coursesObject).filter(course =>
        !selectedCourses.has(course.code) &&
        !selectedMajorCourseCodes.has(course.code)
    );
}

/*
addCoursesFromOption: Adds every course from one pathway option to a map.
Inputs: majorOrMinor (option object), courses (Map)
Outputs: N/A
*/
function addCoursesFromOption(
    majorOrMinor,
    courses
) {
    for (
        const requirement
        of majorOrMinor.Requirements
    ) {
        for (
            const course
            of requirement.Courses
        ) {
            courses.set(
                course.code,
                course
            );
        }
    }
}

/*
scheduleCourses: Schedules selected courses with constraint-based searching.
Inputs: selectedCourses (Map of course codes to Course objects)
Outputs: scheduled (boolean)

Courses are assigned to semesters because slots are interchangeable. The
search propagates domains and backtracks when a course has no valid semester.
coursePlan in state.js is updated only after a complete plan is found.
*/
function scheduleCourses(selectedCourses) {
    const courses =
        new Map(selectedCourses);
    const semesterCount =
        state.coursePlan.length;
    const semesterCapacity =
        state.coursePlan[0].length;

    if (
        courses.size >
        semesterCount * semesterCapacity
    ) {
        return false;
    }

    const selectedMajorKey = state.selectedMajors
        .filter(major => major)
        .map(major => major.Code)
        .sort()
        .join("|");
    const courseSetKey =
        `${semesterCount}x${semesterCapacity}::` +
        `${selectedMajorKey}::` +
        Array.from(courses.keys())
            .sort()
            .join("|");

    if (scheduleCache.has(courseSetKey)) {
        const cachedAssignments =
            scheduleCache.get(courseSetKey);

        if (!cachedAssignments) {
            return false;
        }

        const cachedPlan =
            buildCoursePlan(
                courses,
                new Map(cachedAssignments),
                semesterCount,
                semesterCapacity
            );

        if (!cachedPlan) {
            return false;
        }

        commitCoursePlan(cachedPlan);
        return true;
    }

    const selectedCourseCodes =
        new Set(courses.keys());

    for (const course of courses.values()) {
        if (
            !prerequisiteTreeIsCovered(
                getEffectivePrerequisiteTree(course),
                selectedCourseCodes
            ) ||
            !prerequisiteTreeIsCovered(
                course.corequisites,
                selectedCourseCodes
            )
        ) {
            scheduleCache.set(
                courseSetKey,
                null
            );
            return false;
        }
    }

    const domains =
        buildInitialSemesterDomains(
            courses,
            semesterCount
        );

    if (!domains) {
        scheduleCache.set(courseSetKey, null);
        return false;
    }

    const assignments = new Map();
    const semesterLoads =
        Array(semesterCount).fill(0);

    const dependencyCounts =
        buildDependencyCounts(courses);
    const failedStates = new Set();

    const completedAssignments =
        searchSemesterAssignments(
            courses,
            domains,
            assignments,
            semesterLoads,
            semesterCapacity,
            dependencyCounts,
            failedStates
        );

    if (!completedAssignments) {
        scheduleCache.set(courseSetKey, null);
        return false;
    }

    const completedPlan =
        buildCoursePlan(
            courses,
            completedAssignments,
            semesterCount,
            semesterCapacity
        );

    if (!completedPlan) {
        scheduleCache.set(courseSetKey, null);
        return false;
    }

    scheduleCache.set(
        courseSetKey,
        Array.from(completedAssignments)
    );
    commitCoursePlan(completedPlan);
    return true;
}

/*
offeredThisSemester: Checks whether a course is offered in a semester.
Inputs: course (Course object), semester (integer)
Outputs: isOffered (boolean)
*/
function offeredThisSemester(course, semester) {
    const isSemester1 = semester % 2 === 0;

    if (isSemester1) return course.semester1Offered;
    return course.semester2Offered;
}

const pointPrerequisiteLevels = [5, 6, 7];

/*
getPointPrerequisites: Gets positive point requirements for a course.
Inputs: course (Course object)
Outputs: pointPrerequisites (array of level and point pairs)
*/
function getPointPrerequisites(course) {
    return pointPrerequisiteLevels
        .map(level => [
            level,
            Number(
                course[
                    `level${level}PointsRequired`
                ] ?? 0
            )
        ])
        .filter(
            ([, requiredPoints]) =>
                Number.isFinite(requiredPoints) &&
                requiredPoints > 0
        );
}

/*
pointPrerequisitesCanBeSatisfied: Checks a course's point prerequisites.
Inputs: course (Course object), semester (integer), courses (Map),
assignments (Map), domains (Map or null)
Outputs: canBeSatisfied (boolean)

Only courses in earlier semesters contribute points. Unassigned courses count
when their domain still contains an earlier semester.
*/
function pointPrerequisitesCanBeSatisfied(
    course,
    semester,
    courses,
    assignments,
    domains = null
) {
    for (
        const [level, requiredPoints]
        of getPointPrerequisites(course)
    ) {
        let availablePoints = 0;

        for (const candidate of courses.values()) {
            if (
                candidate.code === course.code ||
                Number(candidate.level) !== level
            ) {
                continue;
            }

            const points = Number(candidate.points);
            if (!Number.isFinite(points)) {
                continue;
            }

            if (assignments.has(candidate.code)) {
                if (
                    assignments.get(candidate.code) <
                    semester
                ) {
                    availablePoints += points;
                }
                continue;
            }

            const candidateDomain =
                domains?.get(candidate.code);

            if (
                candidateDomain?.some(
                    candidateSemester =>
                        candidateSemester < semester
                )
            ) {
                availablePoints += points;
            }
        }

        if (availablePoints < requiredPoints) {
            return false;
        }
    }

    return true;
}

/*
buildInitialSemesterDomains: Builds offered-semester choices for each course.
Inputs: courses (Map), semesterCount (integer)
Outputs: domains (Map of course codes to semester arrays), or null
*/
function buildInitialSemesterDomains(
    courses,
    semesterCount
) {
    const domains = new Map();

    for (const course of courses.values()) {
        const possibleSemesters = [];

        for (
            let semester = 0;
            semester < semesterCount;
            semester++
        ) {
            if (
                offeredThisSemester(
                    course,
                    semester
                )
            ) {
                possibleSemesters.push(
                    semester
                );
            }
        }

        if (possibleSemesters.length === 0) {
            return null;
        }

        domains.set(
            course.code,
            possibleSemesters
        );
    }

    return domains;
}

/*
searchSemesterAssignments: Searches recursively for valid semester choices.
Inputs: courses (Map), domains (Map), assignments (Map), semesterLoads (array),
semesterCapacity (integer), dependencyCounts (Map), failedStates (Set)
Outputs: completedAssignments (Map), or null
*/
function searchSemesterAssignments(
    courses,
    domains,
    assignments,
    semesterLoads,
    semesterCapacity,
    dependencyCounts,
    failedStates
) {
    const propagatedDomains =
        propagateSemesterDomains(
            courses,
            domains,
            assignments,
            semesterLoads,
            semesterCapacity
        );

    if (!propagatedDomains) {
        return null;
    }

    if (assignments.size === courses.size) {
        return assignmentsAreValid(
            courses,
            assignments
        )
            ? assignments
            : null;
    }

    const stateKey =
        getAssignmentStateKey(assignments);

    if (failedStates.has(stateKey)) {
        return null;
    }

    const courseCode =
        selectMostConstrainedCourse(
            courses,
            propagatedDomains,
            assignments,
            dependencyCounts
        );
    const semesters =
        orderSemesterChoices(
            courseCode,
            propagatedDomains,
            assignments,
            semesterLoads,
            semesterCapacity,
            dependencyCounts
        );

    for (const semester of semesters) {
        if (
            semesterLoads[semester] >=
            semesterCapacity
        ) {
            continue;
        }

        const nextAssignments =
            new Map(assignments);
        const nextDomains =
            cloneDomains(
                propagatedDomains
            );
        const nextSemesterLoads =
            [...semesterLoads];

        nextAssignments.set(
            courseCode,
            semester
        );
        nextDomains.set(
            courseCode,
            [semester]
        );
        nextSemesterLoads[semester]++;

        const result =
            searchSemesterAssignments(
                courses,
                nextDomains,
                nextAssignments,
                nextSemesterLoads,
                semesterCapacity,
                dependencyCounts,
                failedStates
            );

        if (result) {
            return result;
        }
    }

    failedStates.add(stateKey);
    return null;
}

/*
propagateSemesterDomains: Removes impossible semesters from course domains.
Inputs: courses (Map), domains (Map), assignments (Map), semesterLoads (array),
semesterCapacity (integer)
Outputs: propagatedDomains (Map), or null
*/
function propagateSemesterDomains(
    courses,
    domains,
    assignments,
    semesterLoads,
    semesterCapacity
) {
    const propagatedDomains =
        cloneDomains(domains);
    let changed = true;

    while (changed) {
        changed = false;

        for (
            const [courseCode, course]
            of courses
        ) {
            if (assignments.has(courseCode)) {
                const semester =
                    assignments.get(courseCode);

                if (
                    !prerequisiteTreeCanBeSatisfied(
                        getEffectivePrerequisiteTree(course),
                        semester,
                        assignments,
                        propagatedDomains
                    ) ||
                    !consecutivePrerequisitesCanBeSatisfied(
                        course,
                        semester,
                        assignments,
                        propagatedDomains
                    ) ||
                    !corequisiteTreeCanBeSatisfied(
                        course.corequisites,
                        semester,
                        assignments,
                        propagatedDomains
                    ) ||
                    !pointPrerequisitesCanBeSatisfied(
                        course,
                        semester,
                        courses,
                        assignments,
                        propagatedDomains
                    )
                ) {
                    return null;
                }

                continue;
            }

            const previousDomain =
                propagatedDomains.get(
                    courseCode
                );
            const nextDomain =
                previousDomain.filter(
                    semester =>
                        semesterLoads[semester] <
                            semesterCapacity &&
                        prerequisiteTreeCanBeSatisfied(
                            getEffectivePrerequisiteTree(course),
                            semester,
                            assignments,
                            propagatedDomains
                        ) &&
                        consecutivePrerequisitesCanBeSatisfied(
                            course,
                            semester,
                            assignments,
                            propagatedDomains
                        ) &&
                        corequisiteTreeCanBeSatisfied(
                            course.corequisites,
                            semester,
                            assignments,
                            propagatedDomains
                        ) &&
                        pointPrerequisitesCanBeSatisfied(
                            course,
                            semester,
                            courses,
                            assignments,
                            propagatedDomains
                        )
                );

            if (nextDomain.length === 0) {
                return null;
            }

            if (
                nextDomain.length !==
                previousDomain.length
            ) {
                propagatedDomains.set(
                    courseCode,
                    nextDomain
                );
                changed = true;
            }
        }

        for (const course of courses.values()) {
            const dependentDomain =
                propagatedDomains.get(
                    course.code
                );
            const result =
                restrictPrerequisiteDomains(
                    getEffectivePrerequisiteTree(course),
                    dependentDomain,
                    assignments,
                    propagatedDomains
                );

            if (!result.valid) {
                return null;
            }

            if (result.changed) {
                changed = true;
            }

            if (course.mustBeTakenConsequtively) {
                const consecutiveResult =
                    restrictPrerequisiteDomains(
                        course.prerequisites,
                        dependentDomain,
                        assignments,
                        propagatedDomains,
                        "consecutive"
                    );

                if (!consecutiveResult.valid) {
                    return null;
                }

                if (consecutiveResult.changed) {
                    changed = true;
                }
            }

            if (course.corequisites) {
                const corequisiteResult =
                    restrictPrerequisiteDomains(
                        course.corequisites,
                        dependentDomain,
                        assignments,
                        propagatedDomains,
                        "same-or-earlier"
                    );

                if (!corequisiteResult.valid) {
                    return null;
                }

                if (corequisiteResult.changed) {
                    changed = true;
                }
            }
        }

        const capacityResult =
            propagateCapacityConstraints(
                propagatedDomains,
                assignments,
                semesterLoads,
                semesterCapacity
            );

        if (!capacityResult.valid) {
            return null;
        }

        if (capacityResult.changed) {
            changed = true;
        }
    }

    return propagatedDomains;
}

/*
restrictPrerequisiteDomains: Narrows domains for prerequisite relationships.
Inputs: node (prerequisite node), dependentDomain (array), assignments (Map),
domains (Map), relationship (string)
Outputs: result (object containing valid and changed booleans)

This pass narrows prerequisite courses from right to left. Consecutive
prerequisites can require a course to be exactly one semester earlier.
*/
function restrictPrerequisiteDomains(
    node,
    dependentDomain,
    assignments,
    domains,
    relationship = "earlier"
) {
    if (!node) {
        return {
            valid: true,
            changed: false
        };
    }

    if (node.type === "COURSE") {
        if (assignments.has(node.value)) {
            const prerequisiteSemester =
                assignments.get(node.value);

            return {
                valid:
                    dependentDomain.some(
                        dependentSemester =>
                            semesterRelationshipIsValid(
                                prerequisiteSemester,
                                dependentSemester,
                                relationship
                            )
                    ),
                changed: false
            };
        }

        const previousDomain =
            domains.get(node.value);

        if (!previousDomain) {
            return {
                valid: false,
                changed: false
            };
        }

        const nextDomain =
            previousDomain.filter(
                prerequisiteSemester =>
                    dependentDomain.some(
                        dependentSemester =>
                            semesterRelationshipIsValid(
                                prerequisiteSemester,
                                dependentSemester,
                                relationship
                            )
                    )
            );

        if (nextDomain.length === 0) {
            return {
                valid: false,
                changed: false
            };
        }

        const changed =
            nextDomain.length !==
            previousDomain.length;

        if (changed) {
            domains.set(
                node.value,
                nextDomain
            );
        }

        return {
            valid: true,
            changed
        };
    }

    if (node.type === "AND") {
        let changed = false;

        for (const child of node.children) {
            const result =
                restrictPrerequisiteDomains(
                    child,
                    dependentDomain,
                    assignments,
                    domains,
                    relationship
                );

            if (!result.valid) {
                return result;
            }

            if (result.changed) {
                changed = true;
            }
        }

        return {
            valid: true,
            changed
        };
    }

    if (node.type === "OR") {
        const viableChildren =
            node.children.filter(
                child =>
                    dependentDomain.some(
                        semester =>
                            relationship === "consecutive"
                                ? prerequisiteTreeCanBeSatisfiedInSemester(
                                    child,
                                    semester - 1,
                                    assignments,
                                    domains
                                )
                                : relationship === "same-or-earlier"
                                    ? corequisiteTreeCanBeSatisfied(
                                        child,
                                        semester,
                                        assignments,
                                        domains
                                    )
                                : prerequisiteTreeCanBeSatisfied(
                                    child,
                                    semester,
                                    assignments,
                                    domains
                                )
                    )
            );

        if (viableChildren.length === 0) {
            return {
                valid: false,
                changed: false
            };
        }

        /*
         * With multiple viable OR branches, restricting either individual
         * branch would discard valid solutions. Once only one branch remains,
         * it becomes mandatory and can safely be propagated.
         */
        if (viableChildren.length === 1) {
            return restrictPrerequisiteDomains(
                viableChildren[0],
                dependentDomain,
                assignments,
                domains,
                relationship
            );
        }

        return {
            valid: true,
            changed: false
        };
    }

    return {
        valid: false,
        changed: false
    };
}

/*
semesterRelationshipIsValid: Checks a relationship between two semesters.
Inputs: requirementSemester (integer), dependentSemester (integer),
relationship (string)
Outputs: isValid (boolean)
*/
function semesterRelationshipIsValid(
    requirementSemester,
    dependentSemester,
    relationship
) {
    if (relationship === "consecutive") {
        return (
            requirementSemester ===
            dependentSemester - 1
        );
    }

    if (relationship === "same-or-earlier") {
        return requirementSemester <= dependentSemester;
    }

    return requirementSemester < dependentSemester;
}

/*
propagateCapacityConstraints: Restricts domains using semester capacity.
Inputs: domains (Map), assignments (Map), semesterLoads (array),
semesterCapacity (integer)
Outputs: result (object containing valid and changed booleans)

Semester subsets with equal course and slot counts reserve those slots. A
subset containing more courses than slots makes the search branch invalid.
*/
function propagateCapacityConstraints(
    domains,
    assignments,
    semesterLoads,
    semesterCapacity
) {
    const semesterCount =
        semesterLoads.length;
    const finalMask =
        1 << semesterCount;
    let changed = false;

    for (
        let semesterMask = 1;
        semesterMask < finalMask;
        semesterMask++
    ) {
        let availableCapacity = 0;

        for (
            let semester = 0;
            semester < semesterCount;
            semester++
        ) {
            if (
                semesterMask &
                (1 << semester)
            ) {
                availableCapacity +=
                    semesterCapacity -
                    semesterLoads[semester];
            }
        }

        const confinedCourseCodes = [];

        for (
            const [courseCode, domain]
            of domains
        ) {
            if (assignments.has(courseCode)) {
                continue;
            }

            const isConfined =
                domain.every(
                    semester =>
                        semesterMask &
                        (1 << semester)
                );

            if (isConfined) {
                confinedCourseCodes.push(
                    courseCode
                );
            }
        }

        if (
            confinedCourseCodes.length >
            availableCapacity
        ) {
            return {
                valid: false,
                changed: false
            };
        }

        if (
            confinedCourseCodes.length !==
            availableCapacity
        ) {
            continue;
        }

        const confinedCourseCodeSet =
            new Set(confinedCourseCodes);

        for (
            const [courseCode, domain]
            of domains
        ) {
            if (
                assignments.has(courseCode) ||
                confinedCourseCodeSet.has(
                    courseCode
                )
            ) {
                continue;
            }

            const nextDomain =
                domain.filter(
                    semester =>
                        !(
                            semesterMask &
                            (1 << semester)
                        )
                );

            if (nextDomain.length === 0) {
                return {
                    valid: false,
                    changed: false
                };
            }

            if (
                nextDomain.length !==
                domain.length
            ) {
                domains.set(
                    courseCode,
                    nextDomain
                );
                changed = true;
            }
        }
    }

    return {
        valid: true,
        changed
    };
}

/*
prerequisiteTreeCanBeSatisfied: Checks a tree against a proposed semester.
Inputs: node (prerequisite node), semester (integer), assignments (Map),
domains (Map)
Outputs: canBeSatisfied (boolean)

An unassigned prerequisite needs an earlier semester in its current domain.
*/
function prerequisiteTreeCanBeSatisfied(
    node,
    semester,
    assignments,
    domains
) {
    if (!node) {
        return true;
    }

    if (node.type === "COURSE") {
        if (assignments.has(node.value)) {
            return (
                assignments.get(node.value) <
                semester
            );
        }

        const prerequisiteDomain =
            domains.get(node.value);

        return Boolean(
            prerequisiteDomain &&
            prerequisiteDomain.some(
                prerequisiteSemester =>
                    prerequisiteSemester <
                    semester
            )
        );
    }

    if (node.type === "AND") {
        return node.children.every(
            child =>
                prerequisiteTreeCanBeSatisfied(
                    child,
                    semester,
                    assignments,
                    domains
                )
        );
    }

    if (node.type === "OR") {
        return node.children.some(
            child =>
                prerequisiteTreeCanBeSatisfied(
                    child,
                    semester,
                    assignments,
                    domains
                )
        );
    }

    return false;
}

/*
corequisiteTreeCanBeSatisfied: Checks a corequisite tree and semester.
Inputs: node (corequisite node), semester (integer), assignments (Map),
domains (Map)
Outputs: canBeSatisfied (boolean)

A corequisite may be completed earlier or in the same semester.
*/
function corequisiteTreeCanBeSatisfied(
    node,
    semester,
    assignments,
    domains
) {
    if (!node) {
        return true;
    }

    if (node.type === "COURSE") {
        if (assignments.has(node.value)) {
            return assignments.get(node.value) <= semester;
        }

        return Boolean(
            domains.get(node.value)?.some(
                corequisiteSemester =>
                    corequisiteSemester <= semester
            )
        );
    }

    if (node.type === "AND") {
        return node.children.every(
            child =>
                corequisiteTreeCanBeSatisfied(
                    child,
                    semester,
                    assignments,
                    domains
                )
        );
    }

    if (node.type === "OR") {
        return node.children.some(
            child =>
                corequisiteTreeCanBeSatisfied(
                    child,
                    semester,
                    assignments,
                    domains
                )
        );
    }

    return false;
}

/*
prerequisiteTreeCanBeSatisfiedInSemester: Checks a tree in one semester.
Inputs: node (prerequisite node), requiredSemester (integer), assignments (Map),
domains (Map)
Outputs: canBeSatisfied (boolean)

This supports courses whose prerequisites must be immediately beforehand.
*/
function prerequisiteTreeCanBeSatisfiedInSemester(
    node,
    requiredSemester,
    assignments,
    domains
) {
    if (!node || requiredSemester < 0) {
        return !node;
    }

    if (node.type === "COURSE") {
        if (assignments.has(node.value)) {
            return (
                assignments.get(node.value) ===
                requiredSemester
            );
        }

        return Boolean(
            domains.get(node.value)?.includes(
                requiredSemester
            )
        );
    }

    if (node.type === "AND") {
        return node.children.every(
            child =>
                prerequisiteTreeCanBeSatisfiedInSemester(
                    child,
                    requiredSemester,
                    assignments,
                    domains
                )
        );
    }

    if (node.type === "OR") {
        return node.children.some(
            child =>
                prerequisiteTreeCanBeSatisfiedInSemester(
                    child,
                    requiredSemester,
                    assignments,
                    domains
                )
        );
    }

    return false;
}

/*
consecutivePrerequisitesCanBeSatisfied: Checks consecutive prerequisites.
Inputs: course (Course object), semester (integer), assignments (Map),
domains (Map)
Outputs: canBeSatisfied (boolean)
*/
function consecutivePrerequisitesCanBeSatisfied(
    course,
    semester,
    assignments,
    domains
) {
    if (!course.mustBeTakenConsequtively) {
        return true;
    }

    return prerequisiteTreeCanBeSatisfiedInSemester(
        course.prerequisites,
        semester - 1,
        assignments,
        domains
    );
}

/*
isCoreCourseCode: Checks whether a course belongs to a Core requirement.
Inputs: courseCode (string)
Outputs: isCoreCourse (boolean)
*/
function isCoreCourseCode(courseCode) {
    return (
        majorOptions.Core?.Requirements.some(
            requirement =>
                requirement.Courses.some(
                    course => course.code === courseCode
                )
        ) ?? false
    );
}

/*
selectMostConstrainedCourse: Selects the next course for the search.
Inputs: courses (Map), domains (Map), assignments (Map), dependencyCounts (Map)
Outputs: courseCode (string)
*/
function selectMostConstrainedCourse(
    courses,
    domains,
    assignments,
    dependencyCounts
) {
    const unassignedCourses =
        Array.from(courses.values())
            .filter(
                course =>
                    !assignments.has(
                        course.code
                    )
            );

    unassignedCourses.sort((a, b) => {
        const corePriorityDifference =
            Number(isCoreCourseCode(b.code)) -
            Number(isCoreCourseCode(a.code));

        if (corePriorityDifference !== 0) {
            return corePriorityDifference;
        }

        const domainDifference =
            domains.get(a.code).length -
            domains.get(b.code).length;

        if (domainDifference !== 0) {
            return domainDifference;
        }

        const dependencyDifference =
            dependencyCounts.get(b.code) -
            dependencyCounts.get(a.code);

        if (dependencyDifference !== 0) {
            return dependencyDifference;
        }

        return a.level - b.level;
    });

    return unassignedCourses[0].code;
}

/*
orderSemesterChoices: Orders possible semesters for one course.
Inputs: courseCode (string), domains (Map), assignments (Map),
semesterLoads (array), semesterCapacity (integer), dependencyCounts (Map)
Outputs: semesters (array of integers)
*/
function orderSemesterChoices(
    courseCode,
    domains,
    assignments,
    semesterLoads,
    semesterCapacity,
    dependencyCounts
) {
    const semesters =
        [...domains.get(courseCode)];
    const hasDependents =
        dependencyCounts.get(courseCode) > 0;
    const isCoreCourse =
        isCoreCourseCode(courseCode);

    semesters.sort((a, b) => {
        /*
         * Core courses are tried chronologically so they appear as early as
         * their academic constraints permit. This remains a preference, not
         * a fixed placement: backtracking can try later semesters when an
         * early choice prevents the rest of the plan from being scheduled.
         */
        if (isCoreCourse && a !== b) {
            return a - b;
        }

        const pressureDifference =
            getSemesterPressure(
                a,
                courseCode,
                domains,
                assignments,
                semesterLoads,
                semesterCapacity
            ) -
            getSemesterPressure(
                b,
                courseCode,
                domains,
                assignments,
                semesterLoads,
                semesterCapacity
            );

        if (pressureDifference !== 0) {
            return pressureDifference;
        }

        /*
         * Prerequisites are generally most useful early. Courses which are
         * not prerequisites for anything else are tried later first, keeping
         * early capacity available for prerequisite chains.
         */
        return hasDependents
            ? a - b
            : b - a;
    });

    return semesters;
}

/*
getSemesterPressure: Calculates competition for one semester's capacity.
Inputs: semester (integer), selectedCourseCode (string), domains (Map),
assignments (Map), semesterLoads (array), semesterCapacity (integer)
Outputs: pressure (number)
*/
function getSemesterPressure(
    semester,
    selectedCourseCode,
    domains,
    assignments,
    semesterLoads,
    semesterCapacity
) {
    let competingCourses = 0;

    for (
        const [courseCode, domain]
        of domains
    ) {
        if (
            courseCode === selectedCourseCode ||
            assignments.has(courseCode)
        ) {
            continue;
        }

        if (domain.includes(semester)) {
            competingCourses +=
                1 / domain.length;
        }
    }

    const remainingCapacity =
        semesterCapacity -
        semesterLoads[semester];

    return (
        competingCourses /
        remainingCapacity
    );
}

/*
buildDependencyCounts: Counts how many selected courses depend on each course.
Inputs: courses (Map of course codes to Course objects)
Outputs: dependencyCounts (Map of course codes to integers)
*/
function buildDependencyCounts(courses) {
    const dependencyCounts =
        new Map(
            Array.from(courses.keys())
                .map(
                    courseCode =>
                        [courseCode, 0]
                )
        );

    for (const course of courses.values()) {
        const prerequisiteCodes =
            new Set();

        collectPrerequisiteCodes(
            getEffectivePrerequisiteTree(course),
            prerequisiteCodes
        );
        collectPrerequisiteCodes(
            course.corequisites,
            prerequisiteCodes
        );

        for (
            const prerequisiteCode
            of prerequisiteCodes
        ) {
            if (
                dependencyCounts.has(
                    prerequisiteCode
                )
            ) {
                dependencyCounts.set(
                    prerequisiteCode,
                    dependencyCounts.get(
                        prerequisiteCode
                    ) + 1
                );
            }
        }
    }

    return dependencyCounts;
}

/*
collectPrerequisiteCodes: Adds every course code from a tree to a set.
Inputs: node (prerequisite node), prerequisiteCodes (Set of strings)
Outputs: N/A
*/
function collectPrerequisiteCodes(
    node,
    prerequisiteCodes
) {
    if (!node) {
        return;
    }

    if (node.type === "COURSE") {
        prerequisiteCodes.add(node.value);
        return;
    }

    for (const child of node.children) {
        collectPrerequisiteCodes(
            child,
            prerequisiteCodes
        );
    }
}

/*
assignmentsAreValid: Checks every constraint in completed assignments.
Inputs: courses (Map), assignments (Map of course codes to semesters)
Outputs: areValid (boolean)
*/
function assignmentsAreValid(
    courses,
    assignments
) {
    for (
        const [courseCode, semester]
        of assignments
    ) {
        const course =
            courses.get(courseCode);
        const completedCourses =
            getCompletedCoursesForSemester(
                assignments,
                semester
            );
        const completedAndCurrentCourses =
            getCompletedCoursesForSemester(
                assignments,
                semester + 1
            );

        if (
            !offeredThisSemester(
                course,
                semester
            ) ||
            !evaluatePrerequisiteTree(
                getEffectivePrerequisiteTree(course),
                completedCourses
            ) ||
            !evaluatePrerequisiteTree(
                course.corequisites,
                completedAndCurrentCourses
            ) ||
            !consecutivePrerequisitesAreValid(
                course,
                semester,
                assignments
            ) ||
            !pointPrerequisitesCanBeSatisfied(
                course,
                semester,
                courses,
                assignments
            )
        ) {
            return false;
        }
    }

    return true;
}

/*
consecutivePrerequisitesAreValid: Validates consecutive prerequisites.
Inputs: course (Course object), semester (integer), assignments (Map)
Outputs: areValid (boolean)
*/
function consecutivePrerequisitesAreValid(
    course,
    semester,
    assignments
) {
    if (!course.mustBeTakenConsequtively) {
        return true;
    }

    const previousSemesterCourses = new Set();

    for (
        const [courseCode, assignedSemester]
        of assignments
    ) {
        if (assignedSemester === semester - 1) {
            previousSemesterCourses.add(courseCode);
        }
    }

    return evaluatePrerequisiteTree(
        course.prerequisites,
        previousSemesterCourses
    );
}

/*
getCompletedCoursesForSemester: Gets courses completed before a semester.
Inputs: assignments (Map), semester (integer)
Outputs: completedCourses (Set of course code strings)
*/
function getCompletedCoursesForSemester(
    assignments,
    semester
) {
    const completedCourses = new Set();

    for (
        const [courseCode, completedSemester]
        of assignments
    ) {
        if (completedSemester < semester) {
            completedCourses.add(courseCode);
        }
    }

    return completedCourses;
}

/*
getAssignmentStateKey: Creates a stable cache key for course assignments.
Inputs: assignments (Map of course codes to semesters)
Outputs: stateKey (string)
*/
function getAssignmentStateKey(assignments) {
    return Array.from(assignments)
        .sort(
            ([courseCodeA], [courseCodeB]) =>
                courseCodeA.localeCompare(
                    courseCodeB
                )
        )
        .map(
            ([courseCode, semester]) =>
                `${courseCode}:${semester}`
        )
        .join("|");
}

/*
cloneDomains: Copies a map of course semester domains.
Inputs: domains (Map of course codes to semester arrays)
Outputs: clonedDomains (Map)
*/
function cloneDomains(domains) {
    return new Map(
        Array.from(domains)
            .map(
                ([courseCode, semesters]) =>
                    [
                        courseCode,
                        [...semesters]
                    ]
            )
    );
}

/*
buildCoursePlan: Converts semester assignments into a course plan grid.
Inputs: courses (Map), assignments (Map), semesterCount (integer),
semesterCapacity (integer)
Outputs: coursePlan (two-dimensional array), or null
*/
function buildCoursePlan(
    courses,
    assignments,
    semesterCount,
    semesterCapacity
) {
    const coursePlan =
        Array.from(
            { length: semesterCount },
            () =>
                Array(
                    semesterCapacity
                ).fill(null)
        );

    const orderedAssignments =
        Array.from(assignments).sort(
            ([courseCodeA, semesterA], [courseCodeB, semesterB]) => {
                if (semesterA !== semesterB) {
                    return semesterA - semesterB;
                }

                return (
                    Number(isCoreCourseCode(courseCodeB)) -
                    Number(isCoreCourseCode(courseCodeA))
                );
            }
        );

    for (const [courseCode, semester] of orderedAssignments) {
        const availableSlot =
            coursePlan[semester]
                .findIndex(
                    course =>
                        course === null
                );

        if (availableSlot === -1) {
            return null;
        }

        coursePlan[semester][availableSlot] =
            courses.get(courseCode);
    }

    return coursePlan;
}

/*
commitCoursePlan: Copies a completed plan into shared application state.
Inputs: coursePlan (two-dimensional array of Course objects or null values)
Outputs: N/A

Updates coursePlan in state.js.
*/
function commitCoursePlan(coursePlan) {
    for (
        let semester = 0;
        semester < coursePlan.length;
        semester++
    ) {
        for (
            let slot = 0;
            slot < coursePlan[semester].length;
            slot++
        ) {
            state.coursePlan[semester][slot] =
                coursePlan[semester][slot];
        }
    }
}


/*
checkIfMajorsAndMinorsSelected: Checks whether pathway selections are complete.
Inputs: N/A
Outputs: selectionsAreValid (boolean)

Reads selectedPathway, selectedMajors, and selectedMinors from state.js.
*/
function checkIfMajorsAndMinorsSelected() {
    // Check that a pathway has been selected.
    if (!state.selectedPathway) {
        alert("Please select a pathway before autopopulating the study plan.");
        return false;
    }
    const selectedPathway = state.selectedPathway;
    // Check that enough majors are selected for the chosen pathway.
    const requiredMajorsCount = selectedPathway.numMajors;
    const selectedMajors = state.selectedMajors;
    const numSelectedMajors = selectedMajors.filter(major => major !== null).length;
    if (numSelectedMajors < requiredMajorsCount) {
        alert(`Please select at least ${requiredMajorsCount} major(s) for the chosen pathway.`);
        return false;
    }

    // Check that enough minors are selected for the chosen pathway.
    const requiredMinorsCount = selectedPathway.numMinors;
    const selectedMinors = state.selectedMinors;
    const numSelectedMinors = selectedMinors.filter(minor => minor !== null).length;
    if (numSelectedMinors < requiredMinorsCount) {
        alert(`Please select at least ${requiredMinorsCount} minor(s) for the chosen pathway.`);
        return false;
    }
    return true;
}

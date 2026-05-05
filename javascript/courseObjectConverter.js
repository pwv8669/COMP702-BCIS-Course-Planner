// The aim of this file is to convert the courses from courses.json to objects which can be used in the application. This is done by creating a Course class and then creating instances of that class for each course in the courses.json file.
class Course {
    constructor(data) {
        this.code = data.Code;
        this.name = data.Name;
        this.points = Number(data.Points);
        this.level = Number(data.Level);
        this.semester1Offered = data.Semester1Offered;
        this.semester2Offered = data.Semester2Offered;
        this.prerequisites = data.Prerequisites
            ? flatten(parse(tokenize(data.Prerequisites)))
            : null;
        this.corequisites = data.Corequisites
            ? flatten(parse(tokenize(data.Corequisites)))
            : null;
    }
    
}

class Node {
    constructor(type, value = null) {
        this.type = type;
        this.value = value;
        this.children = [];
    }
}

function tokenize(input) {
    // This regex matches parentheses, AND, OR, and course codes (e.g., COMP500)
    return input.match(/\(|\)|AND|OR|[A-Z]+\d+/g);
}

function parse(tokens) {
    let index = 0;

    function parseExpression() {
        let node = parseAnd();

        while (tokens[index] === "OR") {
            index++;
            const right = parseAnd();
            const parent = new Node("OR");
            parent.children.push(node, right);
            node = parent;
        }

        return node;
    }

    function parseAnd() {
        let node = parseTerm();

        while (tokens[index] === "AND") {
            index++;
            const right = parseTerm();
            const parent = new Node("AND");
            parent.children.push(node, right);
            node = parent;
        }

        return node;
    }

    function parseTerm() {
        const token = tokens[index++];

        if (token === "(") {
            const node = parseExpression();
            index++; // skip ')'
            return node;
        }

        return new Node("COURSE", token);
    }

    return parseExpression();
}

function flatten(node) {
    if (!node) return node;

    node.children = node.children.map(flatten);

    if (node.type === "AND" || node.type === "OR") {
        let merged = [];

        for (const child of node.children) {
            if (child.type === node.type) {
                merged.push(...child.children);
            } else {
                merged.push(child);
            }
        }

        node.children = merged;
    }

    return node;
}

// Function to export the courses from courses.json to Course objects
export async function loadCourses() {
    const response = await fetch("json/courses.json");
    const data = await response.json();

    return Object.values(data).map(c => new Course(c));
}
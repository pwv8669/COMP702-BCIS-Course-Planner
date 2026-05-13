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
            ? flattenTree(parse(tokenize(data.Prerequisites)))
            : null;
        this.corequisites = data.Corequisites
            ? flattenTree(parse(tokenize(data.Corequisites)))
            : null;
    }
    
}

// Enum for the node types in the prerequisite and corequisite trees. This is used to distinguish between AND, OR, and COURSE nodes when building the tree structure.
const NodeType = {
    AND: "AND",
    OR: "OR",
    COURSE: "COURSE"
};

// Constructor for the Node class, which will be used to create a tree structure for the prerequisites and corequisites of the courses. The type property will be either "AND", "OR", or "COURSE", and the value property will be the course code if the type is "COURSE". The children property will be an array of child nodes, which will represent the prerequisites or corequisites of the course.
class Node {
    constructor(type, value = null) {
        this.type = type;
        this.value = value;
        this.children = [];
    }
}

// The tokenize function takes a string input and returns an array of tokens. The regex used in the match method matches parentheses, AND, OR, and course codes (e.g., COMP500).
function tokenize(input) {
    return input.match(/\(|\)|AND|OR|[A-Z]+\d+/g);
}

// The parse function takes an array of tokens and builds a tree structure based on the logical operators (AND, OR) and parentheses.
function parse(tokens) {
    // We use an index variable to keep track of our position in the tokens array as we parse it. This allows us to move through the tokens sequentially and build our tree structure based on the logical operators and parentheses.
    let index = 0;

    function parseOr() {
        let node = parseAnd();
        // While the next token is "OR", we need to parse the right-hand side and create a new OR node with the left and right as children.
        while (tokens[index] === "OR") {
            index++;
            const right = parseAnd();
            const parent = new Node(NodeType.OR);
            parent.children.push(node, right);
            node = parent;
        }
        // Once we have parsed all the ORs, we return the node. This will be either a COURSE node, an AND node with COURSE nodes as children, or an OR node with AND nodes as children (which in turn have COURSE nodes as children).
        return node;
    }

    function parseAnd() {
        let node = parseTerm();
        // While the next token is "AND", we need to parse the right-hand side and create a new AND node with the left and right as children.
        while (tokens[index] === "AND") {
            index++;
            const right = parseTerm();
            const parent = new Node(NodeType.AND);
            parent.children.push(node, right);
            node = parent;
        }
        // Once we have parsed all the ANDs, we return the node, which will be either a COURSE node or an OR node with COURSE nodes as children.
        return node;
    }

    function parseTerm() {
        const token = tokens[index++];
        // If the token is an opening parenthesis, we need to parse the expression inside it and then expect a closing parenthesis.
        if (token === "(") {
            const node = parseOr();
            index++; // skip ')'
            return node;
        }
        // If the token is not a parenthesis, it must be a course code, so we create a COURSE node with the token as its value.
        return new Node(NodeType.COURSE, token);
    }

    // Start parsing from the top-level expression
    return parseOr();
}

// The flatten function takes a node and recursively flattens any nested AND or OR nodes of the same type. This is done to simplify the tree structure and make it easier to work with when resolving prerequisites and corequisites later on. For example, if we have an AND node that has another AND node as a child, we can merge their children into a single AND node.
function flattenTree(node) {
    if (!node) return node;

    node.children = node.children.map(flattenTree);

    // If the current node is an AND or OR node, we check its children. If any child is of the same type, we merge its children into the current node's children array. This effectively flattens the tree structure by removing unnecessary nesting of the same logical operator.
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

// The resolveTree function takes a node and a courseMap (which is an object mapping course codes to Course objects) and recursively resolves the tree structure of prerequisites and corequisites by replacing COURSE nodes with the actual Course objects from the courseMap. This allows us to easily access the full course data when we need to check prerequisites or corequisites for a given course.
function resolveTree(node, courseMap) {
    if (!node) return;
    // If the node is a COURSE node, we look up the corresponding Course object in the courseMap using the node's value (which is the course code) and attach it to the node. This way, when we later access this node, we can directly access the full Course object instead of just the course code.
    if (node.type === "COURSE") {
        node.course = courseMap[node.value]; // attach object
        return;
    }
    // If the node is an AND or OR node, we need to recursively resolve its children. This will ensure that all COURSE nodes in the tree are replaced with their corresponding Course objects.
    node.children.forEach(child =>
        resolveTree(child, courseMap)
    );
}

export async function loadCourses() {
    // We fetch the courses.json file and parse it as JSON to get the raw course data. This data is expected to be an object where each key is a course code and each value is an object containing the course details (e.g., name, points, prerequisites, etc.).
    const response = await fetch("json/courses.json");
    const data = await response.json();

    // We then create a new object called courses by iterating over the entries of the raw data object. For each entry, we take the course code (the key) and the course details (the value) and create a new Course object using the Course class constructor. We use Object.fromEntries to convert the array of [code, Course] pairs back into an object where each key is a course code and each value is a Course object.
    const courses = Object.fromEntries(
        Object.entries(data).map(
            ([code, c]) => [code, new Course(c)]
        )
    );

    // After we have created the Course objects, we need to resolve the prerequisites and corequisites for each course. We do this by iterating over all the courses and calling the resolveTree function on their prerequisites and corequisites. This will replace any COURSE nodes in the prerequisite and corequisite trees with the actual Course objects, allowing us to easily access all the course data when we need to check prerequisites or corequisites for a given course.
    Object.values(courses).forEach(course => {
        resolveTree(course.prerequisites, courses);
        resolveTree(course.corequisites, courses);
    });

    return courses;
}
// AST Node Types for JQHTML Templates
// Simple, clear node structures for the syntax tree
export var NodeType;
(function (NodeType) {
    NodeType["PROGRAM"] = "Program";
    NodeType["COMPONENT_DEFINITION"] = "ComponentDefinition";
    NodeType["TEXT"] = "Text";
    NodeType["EXPRESSION"] = "Expression";
    NodeType["IF_STATEMENT"] = "IfStatement";
    NodeType["FOR_STATEMENT"] = "ForStatement";
    NodeType["CODE_BLOCK"] = "CodeBlock";
    NodeType["FRAGMENT"] = "Fragment";
})(NodeType || (NodeType = {}));
// Helper to create nodes with common properties
export function createNode(type, props, start, end, line, column) {
    return {
        type,
        start,
        end,
        line,
        column,
        ...props
    };
}

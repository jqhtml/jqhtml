// Test compiling the RS3 datagrid template with JQHTML v2 parser
import { Lexer } from './dist/lexer.js';
import { Parser } from './dist/parser.js';
import { CodeGenerator } from './dist/codegen.js';
import fs from 'fs';

console.log('Testing RS3 Datagrid Template Compilation\n');
console.log('=' .repeat(60));

// Read the datagrid template
const template_path = '/var/www/html/rs3/app/admin/components/datagrid/datagrid.jqhtml';
const template = fs.readFileSync(template_path, 'utf8');

console.log('Template loaded from:', template_path);
console.log('Template size:', template.length, 'characters\n');

try {
    // Step 1: Tokenize
    console.log('Step 1: Tokenization');
    console.log('-'.repeat(20));
    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();
    console.log(`✓ Generated ${tokens.length} tokens`);
    
    // Show first 20 tokens for debugging
    console.log('\nFirst 20 tokens:');
    tokens.slice(0, 20).forEach((token, i) => {
        const value = token.value.replace(/\n/g, '\\n').substring(0, 50);
        console.log(`  ${i + 1}. ${token.type}: "${value}${token.value.length > 50 ? '...' : ''}"`);
    });
    
    // Step 2: Parse
    console.log('\n\nStep 2: Parsing');
    console.log('-'.repeat(20));
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log('✓ Generated AST');
    console.log('Top-level nodes:', ast.body.length);
    
    // Step 3: Generate Code
    console.log('\n\nStep 3: Code Generation');
    console.log('-'.repeat(20));
    const generator = new CodeGenerator();
    const result = generator.generate(ast);
    console.log(`✓ Generated code for ${result.components.size} component(s)`);
    
    // Save the output
    const output_file = 'datagrid-compiled-output.js';
    fs.writeFileSync(output_file, result.code);
    console.log(`\n✓ Generated code saved to: ${output_file}`);
    
    // Show a snippet of the generated code
    console.log('\nGenerated code preview:');
    console.log('```javascript');
    console.log(result.code.split('\n').slice(0, 30).join('\n'));
    console.log('...');
    console.log('```');
    
} catch (error) {
    console.error('\n✗ Compilation failed:');
    console.error(`  Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    
    // Try to provide more context about where it failed
    if (error.message.includes('line')) {
        console.error('\nError context: The error occurred while processing the template.');
    }
}
import * as babel from '@babel/types';
import generate from '@babel/generator';
import { parse } from '@babel/parser';
import { Project } from './Project';
import { buildModel } from './buildModel';

export function expandCodegen(options: {
    stmt: babel.Statement;
    imports: babel.ImportDeclaration[];
    symbols: Map<string, string>;
    project: Project,
    qualifiedName: string
}) {
    const { project, qualifiedName, stmt, imports, symbols } = options;
    let decl: babel.VariableDeclaration;
    if (babel.isExportNamedDeclaration(stmt) && babel.isVariableDeclaration(stmt.declaration)) {
        decl = stmt.declaration;
    } else if (babel.isVariableDeclaration(stmt)) {
        decl = stmt;
    } else {
        return stmt;
    }
    const callExpr = decl.declarations[0].init;
    if (!babel.isCallExpression(callExpr)) {
        return stmt;
    }
    const isCodegen = babel.isIdentifier(callExpr.callee) && callExpr.callee.name === 'codegen';
    if (!isCodegen) {
        return stmt;
    }
    const arrowFuncAst = callExpr.arguments[0];
    if (!babel.isArrowFunctionExpression(arrowFuncAst)) {
        throw new Error(`codegen must be called with arrow function`);
    }
    const argNames = [];
    const argValues = [];
    if (babel.isRestElement(arrowFuncAst.params[0])) {
        const restElement = arrowFuncAst.params[0];
        if (!babel.isIdentifier(restElement.argument)) {
            throw new Error('expect identifier');
        }
        argNames.push(restElement.argument.name);
        const models = [];
        for (const dep of project.listQualifiedNames()) {
            const model = buildModel(project, dep);
            if (model) {
                models.push(model)
            }
        }
        argValues.push(models);
    } else {
        for (const arg of arrowFuncAst.params) {
            if (!babel.isIdentifier(arg)) {
                throw new Error('expect identifier');
            }
            if (!babel.isTSTypeAnnotation(arg.typeAnnotation)) {
                throw new Error('expect ts type annotation');
            }
            const typeRef = arg.typeAnnotation.typeAnnotation;
            if (!babel.isTSTypeReference(typeRef)) {
                throw new Error('expect ts type reference');
            }
            if (!typeRef.typeParameters) {
                throw new Error('expect ts type parameters');
            }
            const typeParam = typeRef.typeParameters.params[0];
            if (!babel.isTSTypeReference(typeParam)) {
                throw new Error('expect ts type ref');
            }
            if (!babel.isIdentifier(typeParam.typeName)) {
                throw new Error('expect identifier');
            }
            const importedFrom = symbols.get(typeParam.typeName.name);
            if (!importedFrom) {
                throw new Error(`symbole ${typeParam.typeName.name} not found`);
            }
            if (!importedFrom.startsWith('@motherboard/')) {
                throw new Error(`Model<T> must reference model class as T`);
            }
            const importQualifiedName = importedFrom.substr('@motherboard/'.length);
            argNames.push(arg.name);
            argValues.push(buildModel(project, importQualifiedName));
        }
    }
    try {
        global.require = require;
    } catch (e) {}
    let code = generate(arrowFuncAst.body).code;
    code = `${translateImportToRequire(imports)}\n${code}`;
    const arrowFunc = new Function(...argNames, code);
    const generatedCode = arrowFunc.apply(undefined, argValues);
    const exportAs = (decl.declarations[0].id as babel.Identifier).name;
    try {
        const generatedAst = parse(`export const ${exportAs} = (() => {${generatedCode}})()`, {
            plugins: [
                'typescript',
                'jsx',
                'classProperties',
                ['decorators', { decoratorsBeforeExport: true }],
            ],
            sourceType: 'module',
            sourceFilename: (stmt.loc as any).filename,
        });
        return generatedAst.program.body[0];
    } catch (e) {
        console.error('\n>>> INVALID GENERATED CODE');
        console.error(generatedCode);
        console.error('<<< INVALID GENERATED CODE\n');
        throw new Error(`generated code is invalid: ${e}`);
    }
}

function translateImportToRequire(imports: babel.ImportDeclaration[]) {
    const lines = [];
    for (const stmt of imports) {
        if (stmt.source.value.startsWith('@motherboard/')) {
            continue;
        }
        for (const specifier of stmt.specifiers) {
            if (babel.isImportDefaultSpecifier(specifier)) {
                lines.push(
                    `const ${specifier.local.name} = require('${stmt.source.value}').default;`,
                );
            } else if (babel.isImportNamespaceSpecifier(specifier)) {
                lines.push(`const ${specifier.local.name} = require('${stmt.source.value}');`);
            } else {
                lines.push(`const { ${specifier.local.name} } = require('${stmt.source.value}');`);
            }
        }
    }
    return lines.join('\n');
}

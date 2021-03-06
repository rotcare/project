import * as babel from '@babel/types';
import { Model } from '@rotcare/codegen';
import generate from '@babel/generator';

export function readModel(classDecl: babel.ClassDeclaration, model: Model) {
    if (babel.isIdentifier(classDecl.superClass)) {
        model.archetype = classDecl.superClass.name;
    }
    translateDecorators(classDecl.decorators, model.decorators);
    for (const member of classDecl.body.body) {
        if (babel.isClassMethod(member) && babel.isIdentifier(member.key)) {
            if (member.static) {
                const modelMethod = {
                    decorators: {},
                    name: member.key.name,
                    paramters: member.params.map((p) => {
                        // TODO
                        return { name: '', type: '' };
                    }),
                };
                translateDecorators(member.decorators, modelMethod.decorators);
                model.staticMethods.push(modelMethod);
            }
            continue;
        } else if (
            babel.isClassProperty(member) &&
            babel.isIdentifier(member.key) &&
            member.accessibility === 'public'
        ) {
            const modelProp = {
                decorators: {},
                name: member.key.name,
                type: babel.isTSTypeAnnotation(member.typeAnnotation)
                    ? generate(member.typeAnnotation.typeAnnotation).code
                    : undefined,
                readonly: !!member.readonly,
            };
            translateDecorators(member.decorators, modelProp.decorators);
            if (member.static) {
                model.staticProperties.push(modelProp);
            } else {
                model.properties.push(modelProp);
            }
        }
    }
}

const countersSym = Symbol();

function translateDecorators(
    babelDecorators: Array<babel.Decorator> | null | undefined,
    modelDecorators: Record<string, any>,
) {
    if (!babelDecorators) {
        return;
    }
    for (const babelDecorator of babelDecorators) {
        let key: string | undefined;
        let value: any;
        if (babel.isIdentifier(babelDecorator.expression)) {
            key = babelDecorator.expression.name;
            value = true;
        } else if (babel.isCallExpression(babelDecorator.expression)) {
            value = babelDecorator.expression.arguments.map((arg) => literalToValue(arg));
            if (babel.isIdentifier(babelDecorator.expression.callee)) {
                key = babelDecorator.expression.callee.name;
            } else if (
                babel.isMemberExpression(babelDecorator.expression.callee) &&
                babel.isIdentifier(babelDecorator.expression.callee.property)
            ) {
                key = babelDecorator.expression.callee.property.name;
            }
        }
        if (key === undefined) {
            continue;
        }
        let counters: Map<string, number> = Reflect.get(modelDecorators, countersSym);
        if (!counters) {
            Reflect.set(modelDecorators, countersSym, (counters = new Map()));
        }
        const count = (counters.get(key) || 0) + 1;
        counters.set(key, count);
        if (count === 1) {
            modelDecorators[key] = value;
        } else if (count === 2) {
            modelDecorators[key] = [value, modelDecorators[key]];
        } else {
            modelDecorators[key].push(value);
        }
    }
}

function literalToValue(expr: babel.Node | null): any {
    if (babel.isNumericLiteral(expr) || babel.isStringLiteral(expr)) {
        return expr.value;
    } else if (babel.isArrayExpression(expr)) {
        return expr.elements.map((elem) => literalToValue(elem));
    } else if (babel.isObjectExpression(expr)) {
        const value: Record<string, any> = {};
        for (const prop of expr.properties) {
            if (babel.isObjectProperty(prop)) {
                if (babel.isStringLiteral(prop.key)) {
                    value[prop.key.value] = literalToValue(prop.value);
                } else if (babel.isIdentifier(prop.key)) {
                    value[prop.key.name] = literalToValue(prop.value);
                }
            }
        }
        return value;
    } else {
        return undefined;
    }
}

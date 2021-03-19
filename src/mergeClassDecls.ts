import { ModelMethod, ModelProperty } from '@rotcare/codegen';
import * as babel from '@babel/types';
import generate from '@babel/generator';

export function mergeClassDecls(options: {
    qualifiedName: string;
    classDecls: babel.ClassDeclaration[];
    model: {
        properties: ModelProperty[];
        staticProperties: ModelProperty[];
        methods: ModelMethod[],
        staticMethods: ModelMethod[]
    }
}): babel.ClassDeclaration {
    const { classDecls, model } = options;
    const methods = new Map<string, babel.ClassMethod>();
    const others = [];
    for (const classDecl of classDecls) {
        for (const member of classDecl.body.body) {
            if (babel.isClassMethod(member) && babel.isIdentifier(member.key)) {
                const baseMethod = methods.get(member.key.name);
                if (baseMethod) {
                    if (!hasVirtualTag(baseMethod)) {
                        throw new Error(
                            `must use @virtual tsdoc comment to mark a method as interface: ${member.key.name}`,
                        );
                    }
                    if (!hasOverrideTag(member)) {
                        throw new Error(
                            `must use @override tsdoc comment to implement virtual method: ${member.key.name}`,
                        );
                    }
                }
                methods.set(member.key.name, { ...member, decorators: [] });
                if (member.static) {
                    model.staticMethods.push({
                        name: member.key.name,
                        paramters: member.params.map(p => {
                            // TODO
                            return { name: '', type: '' }
                        })
                    })
                }
                continue;
            } else if (
                babel.isClassProperty(member) &&
                babel.isIdentifier(member.key) &&
                member.accessibility === 'public'
            ) {
                const prop = {
                    name: member.key.name,
                    type: babel.isTSTypeAnnotation(member.typeAnnotation)
                        ? generate(member.typeAnnotation.typeAnnotation).code
                        : undefined,
                    readonly: !!member.readonly,
                };
                if (member.static) {
                    model.staticProperties.push(prop);
                } else {
                    model.properties.push(prop);
                }
            }
            others.push(member);
        }
    }
    return {
        ...classDecls[0],
        body: { ...classDecls[0].body, body: [...others, ...methods.values()] },
    };
}

function hasOverrideTag(method: babel.ClassMethod) {
    if (!method.leadingComments) {
        return false;
    }
    for (const comment of method.leadingComments) {
        if (comment.value.includes('@override')) {
            return true;
        }
    }
    return false;
}

function hasVirtualTag(method: babel.ClassMethod) {
    if (!method.leadingComments) {
        return false;
    }
    for (const comment of method.leadingComments) {
        if (comment.value.includes('@virtual')) {
            return true;
        }
    }
    return false;
}

import * as babel from '@babel/types';

export function mergeClassDecls(classDecls: babel.ClassDeclaration[]): babel.ClassDeclaration {
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
                continue;
            }
            others.push(member);
        }
    }
    return {
        ...classDecls[0],
        body: { ...classDecls[0].body, body: [...others, ...methods.values()] },
        decorators: [],
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

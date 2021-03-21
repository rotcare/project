import { Model } from '@rotcare/codegen';
import { parse } from '@babel/parser';
import * as babel from '@babel/types';
import { strict } from 'assert';
import { readModel } from './buildModel';

describe('mergeClassDecls', () => {
    it('bare decorator', () => {
        const model = parseModel(`@mysql class Product {}`);
        strict.ok(model.decorators.mysql);
    });
    it('no argument', () => {
        const model = parseModel(`@mysql() class Product {}`);
        strict.deepEqual(model.decorators.mysql, []);
    });
    it('one number argument', () => {
        const model = parseModel(`@mysql(100) class Product {}`);
        strict.deepEqual(model.decorators.mysql, [100]);
    });
    it('one string argument', () => {
        const model = parseModel(`@mysql('hello') class Product {}`);
        strict.deepEqual(model.decorators.mysql, ['hello']);
    });
    it('one array argument', () => {
        const model = parseModel(`@mysql(['hello', 'world']) class Product {}`);
        strict.deepEqual(model.decorators.mysql, [['hello', 'world']]);
    });
    it('one object argument', () => {
        const model = parseModel(`@mysql({ hello: 'world' }) class Product {}`);
        strict.deepEqual(model.decorators.mysql, [{ hello: 'world' }]);
    });
    it('two arguments', () => {
        const model = parseModel(`@mysql(1, 2) class Product {}`);
        strict.deepEqual(model.decorators.mysql, [1, 2]);
    });
    it('two same name decorator', () => {
        const model = parseModel(`@mysql.index('a') @mysql.index('b') class Product {}`);
        strict.deepEqual(model.decorators.index, [['b'], ['a']]);
    });
    it('three same name decorator', () => {
        const model = parseModel(`@mysql.index('a') @mysql.index('b') @mysql.index('c') class Product {}`);
        strict.deepEqual(model.decorators.index, [['b'], ['a'], ['c']]);
    });
});

function parseModel(code: string) {
    const result = parse(code, {
        plugins: [
            'typescript',
            'jsx',
            'classProperties',
            ['decorators', { decoratorsBeforeExport: true }],
        ],
    });
    const model: Model = {
        cacheHash: 1,
        qualifiedName: '',
        tableName: '',
        decorators: {},
        properties: [],
        staticProperties: [],
        methods: [],
        staticMethods: []
    };
    readModel(result.program.body[0] as babel.ClassDeclaration, model);
    return model;
}

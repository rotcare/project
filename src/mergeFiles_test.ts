import { strict } from 'assert';
import { mergeFiles, SrcFile } from './mergeFiles';
import { BuildingModel } from './Project';

describe('mergeFiles', () => {
    it('duplicated import', () => {
        const lines = mergeTwoFiles(`import { a } from 'pkg';`, `import { a } from 'pkg';`);
        strict.equal(lines.length, 2);
        strict.equal(lines[0], `import { a } from 'pkg';`);
    });
});

function mergeTwoFiles(a: string, b: string) {
    const model: BuildingModel = {
        hash: 0,
        resolveDir: '',
        properties: [],
        staticProperties: [],
        methods: [],
        staticMethods: [],
        decorators: {},
        code: '',
        isTsx: false,
        tableName: '',
        qualifiedName: '',
    };
    const srcFiles = new Map<string, SrcFile>();
    srcFiles.set('/a', {
        fileName: '/a',
        package: 'a',
        content: `import { a } from 'pkg';`,
    });
    srcFiles.set('/b', {
        fileName: '/b',
        package: 'b',
        content: `import { a } from 'pkg';`,
    });
    mergeFiles({
        project: {} as any,
        srcFiles,
        model,
    });
    return model.code.split('\n');
}

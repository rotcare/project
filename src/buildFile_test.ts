import { strict } from 'assert';
import { buildFileCode } from './buildFile';

describe('buildFile', () => {
    it('duplicated import', () => {
        const lines = mergeTwoFiles(`import { a } from 'pkg';`, `import { a } from 'pkg';`);
        strict.equal(lines.length, 2);
        strict.equal(lines[0], `import { a } from 'pkg';`);
    });
});

function mergeTwoFiles(a: string, b: string) {
    const srcFiles: Record<string, string> = {};
    srcFiles['/a'] = a;
    srcFiles['/b'] = b;
    return buildFileCode({} as any,
        '',
        srcFiles).split('\n');
}

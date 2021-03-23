import { strict } from 'assert';
import { buildFileCode } from './buildFileCode';

describe('buildFileCode', () => {
    it('duplicated import', () => {
        const js = mergeTwoFiles(`import { a } from 'pkg'; console.log(a);`, `import { a } from 'pkg'; console.log(a);`);
        // import 会被合并成一条
        strict.ok(js.includes('var _pkg = require("pkg")'));
        strict.equal(1, js.match(/require/g)?.length);
        // console.log 仍然是两条
        strict.ok(js.includes('console.log(_pkg.a)'));
        strict.equal(2, js.match(/console\.log/g)?.length);
    });
    it('tsx', () => {
        const js = buildFileCode({} as any, '', { '/a': `
        function someComponent(arg1: string) {
            return <div>hello</div>
        }
        ` });
        // TypeScript 的类型标注会被去掉
        strict.ok(js.includes('function someComponent(arg1) {'));
        // Tsx 被编译为 React.createElement
        strict.ok(js.includes('React.createElement("div", null, "hello")'));
    });
});

function mergeTwoFiles(a: string, b: string) {
    const srcFiles: Record<string, string> = {};
    srcFiles['/a'] = a;
    srcFiles['/b'] = b;
    return buildFileCode({} as any, '', srcFiles);
}

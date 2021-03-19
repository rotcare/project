# project

把 TypeScript project 构建为 JavaScript。提供了三种入口

* `node -r @rotcare/project/register` 用 node 执行 .ts 文件
* `yarn rotcare-show path-to-your-ts-file` 查看构建之后的 .js 内容
* `import { Project } from @rotcare/project` 用 API 驱动代码构建

`@rotcare/project` 在常规的 TypeScript 项目之上增加了如下编译期能力

* codegen：使用 `@rotcare/codegen` 执行自定义的代码生成
* composite project：允许把一个 class 分解到多个 npm 包中，在编译时把 class 的多份代码粘合到一起

如果没有使用 codegen 或者 composite project，可以用 `ts-eager/register` 代替 `@rotcare/project/register`
# TypeScript 项目的高级组织方式

`@rotcare/project` 使用 babel 在常规的 TypeScript 项目之上增加了如下编译期能力

* codegen：使用 `@rotcare/codegen` 执行自定义的代码生成，把生成的代码插入到源代码处
* composite project：允许把一个 class 分解到多个 npm 包中，在编译时把 class 的多份代码粘合到一起

引入这两项能力其目的是把代码做更低耦合地拆分成多个 Git 仓库来编写。

如果没有使用 codegen 或者 composite project，可以直接用 babel 等工具把 TypeScript 转成 JavaScript 代替 `@rotcare/project`

`@rotcare/register` 和 `@rotcare/project-esbuild` 对这个包就行二次封装，使用起来会更贴近场景，更方便一些。

# API

```
yarn add @rotcare/project --dev
```

* [buildFile](./src/buildFile.ts)
* [buildModel](./src/buildModel.ts)
* [watch](./src/watch.ts)
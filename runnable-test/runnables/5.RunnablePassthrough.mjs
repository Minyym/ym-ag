import 'dotenv/config';
import { RunnablePassthrough, RunnableLambda, RunnableSequence, RunnableMap } from "@langchain/core/runnables";

const chain = RunnableSequence.from([
    RunnableLambda.from((input) => ({ concept: input })),
    RunnableMap.from({
        original: new RunnablePassthrough(),
        processed: RunnableLambda.from((obj) => ({
            concept: input,
            upper: obj.concept.toUpperCase(),
            length: obj.concept.length,
        }))
    })
]);
// {
//   original: { concept: '神说要有光' },
//   processed: { concept: '神说要有光', upper: '神说要有光', length: 5 }
// }
// RunnableSequence.from() 创建一个顺序执行的处理链
// 第一个步骤：将输入转换为 { concept: input } 格式
// 第二个步骤：使用 RunnablePassthrough.assign() 向结果中添加新字段
// original 字段：通过 RunnablePassthrough 传递当前对象
// processed 字段：通过函数处理当前对象，生成包含原始概念、大写概念和概念长度的对象

// const chain = RunnableSequence.from([
//     (input) => ({ concept: input }),
//     RunnablePassthrough.assign({
//         original: new RunnablePassthrough(),
//         processed: (obj) => ({
//             concept: input,
//             upper: obj.concept.toUpperCase(),
//             length: obj.concept.length,
//         })
//     })
// ]);
// {
//   concept: '神说要有光',
//   original: { concept: '神说要有光' },
//   processed: { concept: '神说要有光', upper: '神说要有光', length: 5 }
// }

// 现在之前的属性也保留着，只是合并了新的属性，就像 Object.assign 一样。

const input = "神说要有光";
const result = await chain.invoke(input);
console.log(result);
LangChain 表达式语言 (LCEL) 与 Runnable API

LangChain 的许多组件都继承了 Runnable 抽象类。基于 Runnable 提供的 API，我们可以简洁地组装出一条 Chain，无需编写大量冗余逻辑。这种组合方式被称为 LangChain 表达式语言 (LCEL)。

核心 Runnable API

以下是常用的 Runnable 组件及其功能：
组件名称   功能描述
RunnableSequence   顺序执行：将多个步骤按顺序连接执行。

RunnableLambda   函数包装：将自定义 Python 函数包装成 Runnable 对象。

RunnableMap   并行执行：并行运行多个 Chain，并将结果收集到字典的属性中。

RunnableBranch   条件分支：实现 if-else 逻辑，根据条件选择执行路径。

RouterRunnable   路由切换：实现 switch-case 逻辑，根据输入中的 key 决定执行哪个 Chain。

RunnableEach   循环处理：遍历输入数组，对每个元素调用指定的 Chain。

RunnablePassthrough   透传数据：原样返回原始输入（常用于在序列中保留上下文）。

RunnablePick   属性提取：从输入对象中提取特定属性并返回。

RunnableWithMessageHistory   记忆增强：为 Chain 添加记忆（Memory）功能，支持多轮对话。

执行方法

Runnable 接口统一提供了三种主要的执行方法，适应不同的应用场景：

invoke: 同步调用，一次性获取完整结果。
stream: 流式返回，逐步生成并返回结果（适用于 LLM 生成场景）。
batch: 批量调用，高效处理多个输入请求。


用 Runnable 的流程是这样的：分析流程，拆分原子步骤根据步骤之间的关系，选择对应 Runable api统一调用（invoke、stream、batch）



并且写好这个 chain 之后，可以灵活的加一些逻辑：
withConfig 加入一些配置，chain 的节点可以通过第二个参数拿到
withRetry 加上重试逻辑
withFallback 加上备选方案
callbacks 可以加一些回调函数，比如打印节点的输出


总结

掌握这些 Runnable API 后，我们可以将复杂的业务逻辑重构为声明式的 Chain 结构。这种方式不仅代码更简洁、可读性更强，还能充分利用 LangChain 的异步、流式和批处理能力。
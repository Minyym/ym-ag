# 手动验证清单

1. 启动 Milvus  
`docker compose -f milvus/milvus-standalone-docker-compose.yml up -d`

2. 初始化 MySQL 表结构  
执行 `assistant-cli/src/mysql/schema.sql`

3. Ingest 三类数据（各 2 条）  
`node assistant-cli/src/cli.mjs ingest --type contact --text "张三，男，在腾讯做开发，手机号13800138000，微信zhangsan"`  
`node src/cli.mjs ingest --type diary --text "2026-02-05 今天很开心，学会了向量检索"`  
`node src/cli.mjs ingest --type kb --text "标题：RAG。内容：RAG 是检索增强生成的缩写。"`

4. Ask 5 个问题  
`node src/cli.mjs ask --q "张三的手机号是多少？"`  
`node src/cli.mjs ask --q "我哪天写了开心的日记？"`  
`node src/cli.mjs ask --q "RAG 是什么？"`

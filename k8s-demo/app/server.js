const express = require('express');
const app = express();
const PORT = 3000;

// 健康检查（K8s 用）
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'node-demo' });
});

// 根接口
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Node.js Demo in OrbStack K8s!',
    env: process.env.NODE_ENV || 'development'
  });
});

// 测试接口
app.get('/api/user', (req, res) => {
  res.json({
    name: 'OrbStack 用户',
    age: 25,
    from: 'Kubernetes'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
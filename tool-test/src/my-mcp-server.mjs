import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 天气码 → 简短描述（WMO 代码）
const WEATHER_CODE_MAP = {
  0: "晴",
  1: "大部晴朗",
  2: "局部多云",
  3: "阴",
  45: "雾",
  48: "雾凇",
  51: "毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "阵雨",
  81: "小阵雨",
  82: "大阵雨",
  95: "雷雨",
  96: "雷雨伴小冰雹",
  99: "雷雨伴大冰雹",
};

function weatherCodeToText(code) {
  return WEATHER_CODE_MAP[code] ?? `天气码 ${code}`;
}

// 数据库
const database = {
  users: {
    "001": {
      id: "001",
      name: "张三",
      email: "zhangsan@example.com",
      role: "admin",
    },
    "002": { id: "002", name: "李四", email: "lisi@example.com", role: "user" },
    "003": {
      id: "003",
      name: "王五",
      email: "wangwu@example.com",
      role: "user",
    },
  },
};

const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0",
});

// 注册工具：查询用户信息
server.registerTool(
  "query_user",
  {
    description:
      "查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。",
    inputSchema: {
      userId: z.string().describe("用户 ID，例如: 001, 002, 003"),
    },
  },
  async ({ userId }) => {
    const user = database.users[userId];

    if (!user) {
      return {
        content: [
          {
            type: "text",
            text: `用户 ID ${userId} 不存在。可用的 ID: 001, 002, 003`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`,
        },
      ],
    };
  }
);

// 注册工具：获取天气（Open-Meteo，无需 API Key）
server.registerTool(
  "get_weather",
  {
    description:
      "根据城市名称查询当前天气。返回温度（摄氏度）、相对湿度、天气描述。支持中文或英文城市名，如：北京、上海、Tokyo、London。",
    inputSchema: {
      city: z.string().describe("城市名称，如：北京、上海、Tokyo"),
    },
  },
  async ({ city }) => {
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`
      );
      const geoData = await geoRes.json();
      if (!geoData.results?.length) {
        return {
          content: [
            {
              type: "text",
              text: `未找到城市「${city}」，请检查拼写或换一个名称。`,
            },
          ],
        };
      }
      const { latitude, longitude, name } = geoData.results[0];

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code`
      );
      const weatherData = await weatherRes.json();
      const cur = weatherData.current;
      const desc = weatherCodeToText(cur.weather_code);

      const text = `${name} 当前天气：\n- 温度: ${cur.temperature_2m} °C\n- 相对湿度: ${cur.relative_humidity_2m}%\n- 天气: ${desc}`;
      return {
        content: [{ type: "text", text }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `获取天气失败: ${err.message}`,
          },
        ],
      };
    }
  }
);

server.registerResource(
  "使用指南",
  "docs://guide",
  {
    description: "MCP Server 使用文档",
    mimeType: "text/plain",
  },
  async () => {
    return {
      contents: [
        {
          uri: "docs://guide",
          mimeType: "text/plain",
          text: `MCP Server 使用指南

工具：
1. query_user：按用户 ID 查询用户信息（001、002、003）
2. get_weather：按城市名称查询当前天气（温度、湿度、天气描述），支持中英文城市名

使用：在 Cursor 等 MCP Client 中通过自然语言对话，会自动调用相应工具。`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

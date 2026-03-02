
from fastapi import FastAPI, Request, Body, Query
from typing import Optional  
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableSequence, RunnableLambda

# AI 服务类
class AIService:
    def __init__(self, base_url="", model="qwen-coder-turbo", api_key=""):
        """初始化 AI 服务"""
        self.client = ChatOpenAI(
            base_url=base_url,
            model=model,
            api_key=api_key
        )
        # 系统提示，定义陈大师算命先生的角色
        self.system_prompt = "你是陈大师，一位传统的算命先生，精通易经、风水、面相和命理。你说话带有传统韵味，语气神秘但温和，能够根据用户的问题给出富有哲理的解答。你擅长通过命理分析为他人指点迷津，提供人生建议，语气亲切，如同长辈般关怀。每次回复都在开头加上 陈大师我啊 这四个字"
        
        # 初始化情绪分析链
        self.sentiment_chain = self._create_sentiment_chain()
        # 初始化回复生成链
        self.response_chain = self._create_response_chain()
    
    def _create_sentiment_chain(self):
        """创建情绪分析链"""
        # 情绪分析提示
        sentiment_prompt = ChatPromptTemplate.from_messages([
            ("human", "请分析以下用户输入的情绪，仅返回一个单词：积极、消极或中性。\n用户输入：{message}")
        ])
        
        # 创建情绪分析链
        return sentiment_prompt | self.client
    
    def _create_response_chain(self):
        """创建回复生成链"""
        # 回复生成提示
        response_prompt = ChatPromptTemplate.from_messages([
            ("system", "{system_prompt}"),
            ("human", "{message}")
        ])
        
        # 创建回复生成链
        return response_prompt | self.client
    
    def get_response(self, message: str) -> str:
        """获取 AI 回复，根据情绪调整话术"""
        # 分析情绪
        sentiment_result = self.sentiment_chain.invoke({"message": message})
        sentiment = sentiment_result.content.strip()
        
        # 根据情绪调整系统提示
        if sentiment == "积极":
            adjusted_prompt = self.system_prompt + "\n\n用户现在情绪积极，你应该给予积极的肯定和鼓励，语气更加热情。"
        elif sentiment == "消极":
            adjusted_prompt = self.system_prompt + "\n\n用户现在情绪消极，你应该给予安慰和支持，语气更加温和，提供积极的建议。"
        else:  # 中性
            adjusted_prompt = self.system_prompt + "\n\n用户现在情绪中性，你应该保持客观中立，提供平衡的建议。"
        
        # 生成回复
        response_result = self.response_chain.invoke({
            "system_prompt": adjusted_prompt,
            "message": message
        })
        
        return response_result.content
# 1. 创建应用实例
app = FastAPI(
    title="我的第一个项目",
    description="由千问助手引导创建的 FastAPI 项目",
    version="0.1.0"
)

# 2. 初始化 AI 服务
ai_service = AIService()

# 2. 定义一个接口 (路由)
@app.get("/")
async def read_root():
    return {
        "message": "🎉 恭喜！你的第一个 Python 项目运行成功了！",
        "author": "千问助手",
        "status": "active"
    }

@app.get("/items/{item_id}")
async def read_item(item_id: int, q: Optional[str] = None):  # <--- 改这里
    return {"item_id": item_id, "q": q}

# 3. 新增 /chat 接口，用于调用 OpenAI API
@app.post("/chat")
async def chat(message: str = Query(..., description="用户输入的消息", example="你好")):
    """
    调用 OpenAI API 进行聊天
    
    Args:
        message: 用户输入的消息
    
    Returns:
        AI 的回复
    """
    try:
        # 调用 AI 服务获取回复
        response_content = ai_service.get_response(message)
        
        # 返回 AI 的回复
        return {
            "message": message,
            "response": response_content
        }
    except Exception as e:
        return {
            "error": str(e),
            "message": "调用 OpenAI API 失败，请检查模型和 API Key 是否正确"
        }

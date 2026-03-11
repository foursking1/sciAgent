"""
Data source tools for Agent integration.

This module provides tools that the agent can use to access user data sources.
"""

from typing import Any

from backend.db.models.data_source import DataSource
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def get_user_data_sources(
    db: AsyncSession, user_id: int, active_only: bool = True
) -> list[DataSource]:
    """
    Get all data sources for a user.

    Args:
        db: Database session
        user_id: User ID
        active_only: If True, only return active data sources

    Returns:
        List of DataSource objects
    """
    query = select(DataSource).where(DataSource.user_id == user_id)
    if active_only:
        query = query.where(DataSource.is_active.is_(True))
    query = query.order_by(DataSource.created_at.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


def get_database_schema_tool_description(data_source: DataSource) -> str:
    """
    Generate a tool description for a database data source.

    This provides the agent with schema information to reference.
    """
    config = data_source.config
    db_type = config.get("type", "unknown")

    return f"""
数据库数据源: {data_source.name}
类型: {db_type}
配置信息:
- Host: {config.get("host", "N/A")}
- Database: {config.get("database", "N/A")}

使用说明:
- 该数据源提供数据库 schema 信息供 Agent 参考
- Agent 可以根据 schema 生成 SQL 查询
- 如需执行查询，请向用户确认
"""


def get_vector_store_tool_description(data_source: DataSource) -> str:
    """
    Generate a tool description for a vector store data source.
    """
    config = data_source.config
    collection = config.get("collection", "unknown")

    return f"""
向量库数据源: {data_source.name}
Collection: {collection}
Embedding模型: {config.get("embedding_model", "default")}

使用说明:
- 该数据源可用于语义检索
- Agent 可以调用向量搜索工具查找相关文档
- 适用于知识库问答、文档检索等场景
"""


def get_skill_tool_description(data_source: DataSource) -> str:
    """
    Generate a tool description for a skill data source.
    """
    config = data_source.config
    skill_name = config.get("skill_name", "unknown")

    return f"""
Skill数据源: {data_source.name}
Skill名称: {skill_name}
端点: {config.get("endpoint", "N/A")}

使用说明:
- 该数据源是一个自定义技能
- Agent 可以调用此技能获取数据
- 参数: {config.get("params", {})}
"""


def get_tool_descriptions_for_data_sources(data_sources: list[DataSource]) -> str:
    """
    Generate combined tool descriptions for all data sources.

    This can be injected into the agent's system prompt.
    """
    if not data_sources:
        return ""

    descriptions = []
    for ds in data_sources:
        if ds.type == "database":
            descriptions.append(get_database_schema_tool_description(ds))
        elif ds.type == "vector_store":
            descriptions.append(get_vector_store_tool_description(ds))
        elif ds.type == "skill":
            descriptions.append(get_skill_tool_description(ds))

    return "\n---\n".join(descriptions)


class DataSourceTools:
    """
    Tools for interacting with data sources in agent context.
    """

    @staticmethod
    def get_tool_definitions(data_sources: list[DataSource]) -> list[dict[str, Any]]:
        """
        Get tool definitions in a format suitable for agent registration.

        Returns a list of tool definitions that can be used with
        agentic-data-scientist or similar agent frameworks.
        """
        tools = []

        for ds in data_sources:
            if ds.type == "database":
                tools.append(
                    {
                        "name": f"query_database_{ds.id}",
                        "description": f"Query the {ds.name} database. Returns schema information.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": "SQL query to execute (SELECT only)",
                                }
                            },
                            "required": ["query"],
                        },
                        "data_source_id": ds.id,
                    }
                )

            elif ds.type == "vector_store":
                tools.append(
                    {
                        "name": f"search_vector_store_{ds.id}",
                        "description": f"Search the {ds.name} vector store for relevant documents.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": "Search query text",
                                },
                                "top_k": {
                                    "type": "integer",
                                    "description": "Number of results to return",
                                    "default": 5,
                                },
                            },
                            "required": ["query"],
                        },
                        "data_source_id": ds.id,
                    }
                )

            elif ds.type == "skill":
                tools.append(
                    {
                        "name": f"call_skill_{ds.id}",
                        "description": f"Call the {ds.name} skill with parameters.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "params": {
                                    "type": "object",
                                    "description": "Parameters to pass to the skill",
                                }
                            },
                            "required": ["params"],
                        },
                        "data_source_id": ds.id,
                    }
                )

        return tools

    @staticmethod
    async def execute_tool(
        db: AsyncSession, user_id: int, tool_name: str, arguments: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Execute a data source tool.

        This is called when the agent wants to use a data source.
        """
        # Parse tool name to get type and ID
        parts = tool_name.rsplit("_", 1)
        if len(parts) != 2:
            return {"error": f"Invalid tool name: {tool_name}"}

        tool_type = parts[0]
        try:
            data_source_id = int(parts[1])
        except ValueError:
            return {"error": f"Invalid data source ID in tool name: {tool_name}"}

        # Get the data source
        result = await db.execute(
            select(DataSource).where(
                DataSource.id == data_source_id,
                DataSource.user_id == user_id,
                DataSource.is_active.is_(True),
            )
        )
        data_source = result.scalar_one_or_none()

        if not data_source:
            return {"error": f"Data source not found or inactive: {data_source_id}"}

        # Execute based on type
        if tool_type == "query_database":
            # TODO: Implement actual database query
            return {
                "message": f"Database query not implemented yet. Data source: {data_source.name}",
                "schema": data_source.config,
            }

        elif tool_type == "search_vector_store":
            # TODO: Implement actual vector search
            return {
                "message": f"Vector search not implemented yet. Data source: {data_source.name}",
                "query": arguments.get("query"),
                "top_k": arguments.get("top_k", 5),
            }

        elif tool_type == "call_skill":
            # TODO: Implement actual skill call
            return {
                "message": f"Skill call not implemented yet. Data source: {data_source.name}",
                "params": arguments.get("params"),
            }

        else:
            return {"error": f"Unknown tool type: {tool_type}"}

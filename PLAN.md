# 数据源 Market 功能 - TDD 开发方案

## 概述

实现可折叠侧边栏 + 数据源 Market 功能，采用测试驱动开发（TDD）方法。

## 技术栈

- **后端**: FastAPI, SQLAlchemy 2.0 (async), pytest-asyncio
- **前端**: Next.js 14, TypeScript, TailwindCSS
- **测试模式**: 每个功能先写测试，再实现代码

---

## Phase 1: 可折叠侧边栏 (前端)

### 1.1 目标
- 左侧边栏支持完全隐藏/展开切换
- 主内容区和输入框自适应宽度

### 1.2 测试用例 (前端组件测试)

```typescript
// frontend/components/chat/__tests__/SessionSidebar.test.tsx

describe('SessionSidebar', () => {
  it('should render collapsed by default when isCollapsed prop is true')
  it('should toggle visibility when collapse button is clicked')
  it('should hide completely when collapsed (w-0)')
  it('should show full width when expanded (w-[280px])')
  it('should adjust main content margin when sidebar collapses')
})
```

### 1.3 实现步骤

1. **编写测试**: 创建 `SessionSidebar.test.tsx`
2. **修改 SessionSidebar**:
   - 添加 `isCollapsed` 和 `onToggle` props
   - 添加折叠按钮
   - 使用 CSS transition 实现动画
3. **修改 SessionChat**:
   - 管理 `isSidebarCollapsed` 状态
   - 调整主内容区和固定输入框的 `left` 样式
4. **运行测试确认通过**

---

## Phase 2: 数据源模型与API (后端)

### 2.1 数据库模型设计

```python
# backend/db/models/data_source.py

class DataSource(Base):
    """用户级别的数据源"""
    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'database' | 'vector_store' | 'skill'
    config: Mapped[dict] = mapped_column(JSON, nullable=False)  # 连接配置
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="data_sources")
```

### 2.2 测试用例 (后端模型)

```python
# backend/tests/test_db/test_data_source_model.py

class TestDataSourceModel:
    """Tests for DataSource model"""

    async def test_create_database_data_source(self, async_session, test_user):
        """测试创建数据库类型数据源"""
        ...

    async def test_create_vector_store_data_source(self, async_session, test_user):
        """测试创建向量库类型数据源"""
        ...

    async def test_create_skill_data_source(self, async_session, test_user):
        """测试创建Skill类型数据源"""
        ...

    async def test_data_source_user_relationship(self, async_session, test_user):
        """测试数据源与用户的关系"""
        ...

    async def test_data_source_config_json_field(self, async_session, test_user):
        """测试config字段存储JSON"""
        ...

    async def test_cascade_delete_on_user_delete(self, async_session, test_user):
        """测试用户删除时级联删除数据源"""
        ...

    async def test_unique_name_per_user(self, async_session, test_user):
        """测试同一用户下数据源名称唯一"""
        ...
```

### 2.3 API 端点设计

```
GET    /api/data-sources              # 列出用户所有数据源
POST   /api/data-sources              # 创建新数据源
GET    /api/data-sources/{id}         # 获取数据源详情
PUT    /api/data-sources/{id}         # 更新数据源
DELETE /api/data-sources/{id}         # 删除数据源
POST   /api/data-sources/{id}/test    # 测试数据源连接
```

### 2.4 测试用例 (API)

```python
# backend/tests/test_api/test_data_sources.py

class TestDataSourcesAPI:
    """Tests for DataSources API endpoints"""

    async def test_list_data_sources_empty(self, async_client, auth_headers):
        """测试空列表"""
        ...

    async def test_create_database_data_source(self, async_client, auth_headers):
        """测试创建数据库数据源"""
        ...

    async def test_create_vector_store_data_source(self, async_client, auth_headers):
        """测试创建向量库数据源"""
        ...

    async def test_create_skill_data_source(self, async_client, auth_headers):
        """测试创建Skill数据源"""
        ...

    async def test_get_data_source_by_id(self, async_client, auth_headers, test_data_source):
        """测试获取数据源详情"""
        ...

    async def test_update_data_source(self, async_client, auth_headers, test_data_source):
        """测试更新数据源"""
        ...

    async def test_delete_data_source(self, async_client, auth_headers, test_data_source):
        """测试删除数据源"""
        ...

    async def test_test_database_connection_success(self, async_client, auth_headers, test_db_source):
        """测试数据库连接成功"""
        ...

    async def test_test_database_connection_failure(self, async_client, auth_headers, test_db_source):
        """测试数据库连接失败"""
        ...

    async def test_unauthorized_access(self, async_client):
        """测试未授权访问"""
        ...

    async def test_cross_user_access_denied(self, async_client, auth_headers, other_user_source):
        """测试跨用户访问被拒绝"""
        ...
```

### 2.5 实现步骤

1. **编写模型测试** → 运行测试（失败）
2. **实现 DataSource 模型** → 运行测试（通过）
3. **创建数据库迁移**
4. **编写 API 测试** → 运行测试（失败）
5. **实现 API 端点**:
   - `backend/api/routes/data_sources.py`
   - `backend/schemas/data_sources.py`
   - `backend/services/data_source_service.py`
6. **注册路由到 main.py** → 运行测试（通过）

---

## Phase 3: 数据源 Market 前端

### 3.1 组件结构

```
frontend/components/data-sources/
├── DataSourceModal.tsx       # Modal弹窗主组件
├── DataSourceList.tsx        # 数据源列表
├── DataSourceForm.tsx        # 创建/编辑表单
├── DataSourceCard.tsx        # 单个数据源卡片
├── DatabaseConfigForm.tsx    # 数据库配置表单
├── VectorStoreConfigForm.tsx # 向量库配置表单
└── SkillConfigForm.tsx       # Skill配置表单
```

### 3.2 测试用例 (前端)

```typescript
// frontend/components/data-sources/__tests__/DataSourceModal.test.tsx

describe('DataSourceModal', () => {
  it('should not render when isOpen is false')
  it('should render when isOpen is true')
  it('should close when clicking outside or close button')
  it('should show empty state when no data sources')
  it('should show data source list when data exists')
  it('should open create form when clicking add button')
  it('should call onDelete when delete button clicked')
})

describe('DataSourceForm', () => {
  it('should show different config forms based on type')
  it('should validate required fields')
  it('should call onSubmit with correct data')
  it('should show connection test result')
})
```

### 3.3 实现步骤

1. **编写组件测试** → 运行测试（失败）
2. **实现组件**:
   - `DataSourceModal.tsx`
   - `DataSourceList.tsx`
   - `DataSourceForm.tsx`
   - 各类型配置表单
3. **添加 API 客户端**:
   - 扩展 `frontend/lib/api.ts` 添加 `dataSourcesApi`
4. **集成到 SessionSidebar**:
   - 添加数据源按钮
   - 管理弹窗状态
5. **运行测试（通过）**

---

## Phase 4: Agent 工具调用集成

### 4.1 目标
- 用户的数据源自动注册为 Agent 可用工具
- Agent 根据问题自动判断调用哪个工具

### 4.2 工具设计

```python
# backend/services/data_source_tools.py

class DataSourceTools:
    """Agent工具：数据源操作"""

    @staticmethod
    def get_database_schema_tool(data_source: DataSource):
        """返回数据库schema查询工具"""
        ...

    @staticmethod
    def get_vector_search_tool(data_source: DataSource):
        """返回向量库搜索工具"""
        ...

    @staticmethod
    def get_skill_call_tool(data_source: DataSource):
        """返回Skill调用工具"""
        ...

def get_user_tools(user_id: int) -> list[Tool]:
    """获取用户所有数据源对应的工具列表"""
    ...
```

### 4.3 测试用例

```python
# backend/tests/test_services/test_data_source_tools.py

class TestDataSourceTools:
    """Tests for DataSource tools"""

    async def test_get_database_schema_tool_creation(self, test_db_source):
        """测试数据库schema工具创建"""
        ...

    async def test_get_vector_search_tool_creation(self, test_vector_source):
        """测试向量库搜索工具创建"""
        ...

    async def test_get_skill_call_tool_creation(self, test_skill_source):
        """测试Skill调用工具创建"""
        ...

    async def test_get_user_tools_returns_all_tools(self, test_user, test_data_sources):
        """测试获取用户所有工具"""
        ...

    async def test_inactive_source_not_included(self, test_user, test_inactive_source):
        """测试非活跃数据源不包含"""
        ...
```

### 4.4 SessionManager 集成

修改 `SessionManager` 在创建 Agent 时注入数据源工具：

```python
# backend/services/session_manager.py

class SessionManager:
    async def create_agent_with_data_sources(self, user_id: int, session_id: str):
        """创建Agent并注入用户数据源工具"""
        data_sources = await get_user_data_sources(user_id)
        tools = get_user_tools(data_sources)
        # 注入到 Agent
        ...
```

### 4.5 实现步骤

1. **编写工具测试** → 运行测试（失败）
2. **实现 DataSourceTools** → 运行测试（通过）
3. **编写集成测试** → 运行测试（失败）
4. **修改 SessionManager** → 运行测试（通过）

---

## Phase 5: 端到端测试

### 5.1 测试场景

```python
# backend/tests/integration/test_data_source_e2e.py

class TestDataSourceE2E:
    """End-to-end tests for data source feature"""

    async def test_full_workflow(self, async_client, auth_headers):
        """完整工作流测试：
        1. 创建数据源
        2. 创建会话
        3. 发送问题
        4. Agent使用数据源工具
        5. 返回结果
        """
        ...
```

---

## 文件清单

### 新增文件

**后端:**
- `backend/db/models/data_source.py`
- `backend/db/migrations/versions/00X_add_data_sources.py`
- `backend/api/routes/data_sources.py`
- `backend/schemas/data_sources.py`
- `backend/services/data_source_service.py`
- `backend/services/data_source_tools.py`
- `backend/tests/test_db/test_data_source_model.py`
- `backend/tests/test_api/test_data_sources.py`
- `backend/tests/test_services/test_data_source_tools.py`
- `backend/tests/integration/test_data_source_e2e.py`

**前端:**
- `frontend/components/data-sources/DataSourceModal.tsx`
- `frontend/components/data-sources/DataSourceList.tsx`
- `frontend/components/data-sources/DataSourceForm.tsx`
- `frontend/components/data-sources/DataSourceCard.tsx`
- `frontend/components/data-sources/DatabaseConfigForm.tsx`
- `frontend/components/data-sources/VectorStoreConfigForm.tsx`
- `frontend/components/data-sources/SkillConfigForm.tsx`
- `frontend/components/data-sources/__tests__/*.test.tsx`

### 修改文件

- `backend/db/database.py` - 添加 DataSource 到 Base
- `backend/db/models/user.py` - 添加 data_sources 关系
- `backend/main.py` - 注册数据源路由
- `backend/services/session_manager.py` - 集成数据源工具
- `frontend/components/chat/SessionSidebar.tsx` - 添加折叠功能
- `frontend/components/chat/SessionChat.tsx` - 管理侧边栏状态
- `frontend/lib/api.ts` - 添加 dataSourcesApi

---

## 执行顺序

```
Phase 1 (前端侧边栏) → Phase 2 (后端模型+API) → Phase 3 (前端Market) → Phase 4 (Agent集成) → Phase 5 (E2E测试)
```

每个 Phase 内部遵循 TDD 循环：
1. **Red** - 编写失败测试
2. **Green** - 实现代码使测试通过
3. **Refactor** - 重构优化
